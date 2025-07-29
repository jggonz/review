const { differenceInDays, parseISO } = require('date-fns');
const config = require('./config');

class ReviewerSelector {
  constructor(prHistory, openPRs) {
    this.prHistory = prHistory;
    this.openPRs = openPRs;
    this.reviewStats = this.calculateReviewStats();
  }

  calculateReviewStats() {
    const stats = {};
    const now = new Date();
    const cfg = config.get();
    const team = cfg.team || [];
    
    // Initialize stats for all team members
    team.forEach(member => {
      if (!member.includes('[bot]')) {
        stats[member] = {
          totalReviews: 0,
          totalApprovals: 0,
          lastReviewDate: null,
          lastApprovalDate: null,
          daysSinceLastReview: Infinity,
          daysSinceLastApproval: Infinity,
          pendingReviews: 0
        };
      }
    });
    
    this.prHistory.forEach(pr => {
      pr.reviews?.forEach(review => {
        const reviewer = review.author?.login;
        if (!reviewer || reviewer.includes('[bot]')) return;
        
        if (!stats[reviewer]) {
          stats[reviewer] = {
            totalReviews: 0,
            totalApprovals: 0,
            lastReviewDate: null,
            lastApprovalDate: null,
            daysSinceLastReview: Infinity,
            daysSinceLastApproval: Infinity
          };
        }
        
        stats[reviewer].totalReviews++;
        
        const reviewDate = new Date(review.submittedAt || pr.closedAt);
        if (!stats[reviewer].lastReviewDate || reviewDate > stats[reviewer].lastReviewDate) {
          stats[reviewer].lastReviewDate = reviewDate;
          stats[reviewer].daysSinceLastReview = differenceInDays(now, reviewDate);
        }
        
        // Track approvals separately - GitHub review states: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED
        if (review.state === 'APPROVED') {
          stats[reviewer].totalApprovals++;
          // Track last approval date separately
          if (!stats[reviewer].lastApprovalDate || reviewDate > stats[reviewer].lastApprovalDate) {
            stats[reviewer].lastApprovalDate = reviewDate;
            stats[reviewer].daysSinceLastApproval = differenceInDays(now, reviewDate);
          }
        }
      });
      
      pr.reviewRequests?.forEach(req => {
        const reviewer = req.login;
        if (!reviewer || reviewer.includes('[bot]')) return;
        
        if (!stats[reviewer]) {
          stats[reviewer] = {
            totalReviews: 0,
            lastReviewDate: null,
            daysSinceLastReview: Infinity
          };
        }
      });
    });
    
    const pendingReviews = {};
    this.openPRs.forEach(pr => {
      pr.reviewRequests?.forEach(req => {
        const reviewer = req.login;
        if (!reviewer || reviewer.includes('[bot]')) return;
        pendingReviews[reviewer] = (pendingReviews[reviewer] || 0) + 1;
      });
    });
    
    Object.keys(stats).forEach(reviewer => {
      stats[reviewer].pendingReviews = pendingReviews[reviewer] || 0;
    });
    
    return stats;
  }

  getEligibleReviewers(author, teamMembers = null) {
    const cfg = config.get();
    const team = teamMembers || cfg.team || [];
    const excluded = cfg.excluded || [];
    
    // If we have a configured team, only use those members
    // Otherwise fall back to reviewers found in history
    let eligiblePool;
    if (team.length > 0) {
      eligiblePool = team;
    } else {
      eligiblePool = Object.keys(this.reviewStats);
    }
    
    return eligiblePool.filter(reviewer => {
      if (author && reviewer === author) return false;
      if (excluded.includes(reviewer)) return false;
      if (config.isUnavailable(reviewer)) return false;
      if (reviewer.includes('[bot]')) return false;
      return true;
    });
  }

  calculateScore(reviewer) {
    const cfg = config.get();
    const weights = cfg.weights;
    const stats = this.reviewStats[reviewer] || {
      totalReviews: 0,
      totalApprovals: 0,
      lastReviewDate: null,
      lastApprovalDate: null,
      daysSinceLastReview: Infinity,
      daysSinceLastApproval: Infinity,
      pendingReviews: 0
    };
    
    let score = 0;
    
    // Primary factor: Days since last approval (not just review)
    const approvalRecencyScore = Math.min(stats.daysSinceLastApproval, 30) * weights.approvals;
    score += approvalRecencyScore;
    
    // Secondary factor: Days since any review (comment, changes requested, etc.)
    const reviewRecencyScore = Math.min(stats.daysSinceLastReview, 30) * weights.recency;
    score += reviewRecencyScore;
    
    // Balance factors
    const avgApprovals = this.getAverageApprovals();
    const approvalBalanceFactor = avgApprovals - stats.totalApprovals;
    const approvalBalanceScore = approvalBalanceFactor * weights.balance;
    score += approvalBalanceScore;
    
    // Workload penalty
    const workloadScore = -stats.pendingReviews * weights.workload * 10;
    score += workloadScore;
    
    if (stats.pendingReviews >= (cfg.maxPendingReviews || 3)) {
      score -= 1000;
    }
    
    return {
      reviewer,
      score,
      stats,
      breakdown: {
        approvalRecency: approvalRecencyScore,
        reviewRecency: reviewRecencyScore,
        approvalBalance: approvalBalanceScore,
        workload: workloadScore
      }
    };
  }

  getAverageReviews() {
    const cfg = config.get();
    const team = cfg.team || [];
    
    // If we have a configured team, calculate average only for team members
    let reviewersToConsider = team.length > 0 ? team : Object.keys(this.reviewStats);
    
    const reviewCounts = reviewersToConsider
      .filter(reviewer => !reviewer.includes('[bot]'))
      .map(reviewer => this.reviewStats[reviewer]?.totalReviews || 0);
    
    if (reviewCounts.length === 0) return 0;
    return reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length;
  }

  getAverageApprovals() {
    const cfg = config.get();
    const team = cfg.team || [];
    
    // If we have a configured team, calculate average only for team members
    let reviewersToConsider = team.length > 0 ? team : Object.keys(this.reviewStats);
    
    const approvalCounts = reviewersToConsider
      .filter(reviewer => !reviewer.includes('[bot]'))
      .map(reviewer => this.reviewStats[reviewer]?.totalApprovals || 0);
    
    if (approvalCounts.length === 0) return 0;
    return approvalCounts.reduce((a, b) => a + b, 0) / approvalCounts.length;
  }

  selectReviewer(author, count = 1) {
    const eligibleReviewers = this.getEligibleReviewers(author);
    
    if (eligibleReviewers.length === 0) {
      return null;
    }
    
    const scores = eligibleReviewers.map(reviewer => this.calculateScore(reviewer));
    scores.sort((a, b) => b.score - a.score);
    
    return count === 1 ? scores[0] : scores.slice(0, count);
  }

  getReviewerQueue(author, count = 5) {
    return this.selectReviewer(author, count);
  }
}

module.exports = ReviewerSelector;