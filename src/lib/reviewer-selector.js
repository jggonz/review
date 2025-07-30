const config = require('./config');

class ReviewerSelector {
  constructor(prHistory, openPRs) {
    this.prHistory = prHistory;
    this.openPRs = openPRs;
  }

  // Get the last N PRs and track who approved them
  getRecentApprovals() {
    const cfg = config.get();
    const lookbackPRs = cfg.lookbackPRs || 30;
    
    // Sort PRs by most recent first, then take the last N
    const recentPRs = this.prHistory
      .sort((a, b) => new Date(b.closedAt || b.updatedAt) - new Date(a.closedAt || a.updatedAt))
      .slice(0, lookbackPRs);
    
    const approvals = [];
    
    recentPRs.forEach(pr => {
      pr.reviews?.forEach(review => {
        if (review.state === 'APPROVED' && review.author?.login && !review.author.login.includes('[bot]')) {
          approvals.push({
            reviewer: review.author.login,
            prNumber: pr.number,
            date: new Date(review.submittedAt || pr.closedAt)
          });
        }
      });
    });
    
    // Sort approvals by most recent first
    return approvals.sort((a, b) => b.date - a.date);
  }

  // Get current pending review requests
  getPendingReviews() {
    const pending = {};
    
    this.openPRs.forEach(pr => {
      pr.reviewRequests?.forEach(req => {
        if (req.login && !req.login.includes('[bot]')) {
          pending[req.login] = (pending[req.login] || 0) + 1;
        }
      });
    });
    
    return pending;
  }

  getEligibleReviewers(author) {
    const cfg = config.get();
    const team = cfg.team || [];
    const excluded = cfg.excluded || [];
    
    return team.filter(reviewer => {
      if (author && reviewer === author) return false;
      if (excluded.includes(reviewer)) return false;
      if (config.isUnavailable(reviewer)) return false;
      if (reviewer.includes('[bot]')) return false;
      return true;
    });
  }

  selectReviewer(author, count = 1) {
    const eligibleReviewers = this.getEligibleReviewers(author);
    
    if (eligibleReviewers.length === 0) {
      return null;
    }

    const recentApprovals = this.getRecentApprovals();
    const pendingReviews = this.getPendingReviews();
    const cfg = config.get();
    const maxPendingReviews = cfg.maxPendingReviews || 3;
    
    // Create approval frequency map from recent PRs
    const approvalCounts = {};
    eligibleReviewers.forEach(reviewer => {
      approvalCounts[reviewer] = 0;
    });
    
    recentApprovals.forEach(approval => {
      if (approvalCounts.hasOwnProperty(approval.reviewer)) {
        approvalCounts[approval.reviewer]++;
      }
    });
    
    // Score reviewers: lower score = higher priority
    const scoredReviewers = eligibleReviewers.map(reviewer => {
      let score = 0;
      
      // Primary factor: number of recent approvals (fewer = better)
      score += approvalCounts[reviewer] * 10;
      
      // Secondary factor: pending reviews (fewer = better)
      const pending = pendingReviews[reviewer] || 0;
      score += pending * 5;
      
      // Heavy penalty for exceeding max pending reviews
      if (pending >= maxPendingReviews) {
        score += 1000;
      }
      
      return {
        reviewer,
        score,
        stats: {
          recentApprovals: approvalCounts[reviewer],
          pendingReviews: pending,
          lastApprovalIndex: this.getLastApprovalIndex(reviewer, recentApprovals)
        }
      };
    });
    
    // Sort by score (lowest first), then by last approval index (higher = longer ago)
    scoredReviewers.sort((a, b) => {
      // First priority: users with 0 pending reviews
      const aPending = a.stats.pendingReviews;
      const bPending = b.stats.pendingReviews;
      
      if (aPending === 0 && bPending > 0) return -1;
      if (bPending === 0 && aPending > 0) return 1;
      
      // Second priority: score comparison
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      
      // Third priority: who approved longest ago
      return b.stats.lastApprovalIndex - a.stats.lastApprovalIndex;
    });
    
    return count === 1 ? scoredReviewers[0] : scoredReviewers.slice(0, count);
  }
  
  // Find the index of the most recent approval by this reviewer (higher = longer ago)
  getLastApprovalIndex(reviewer, recentApprovals) {
    const index = recentApprovals.findIndex(approval => approval.reviewer === reviewer);
    return index === -1 ? recentApprovals.length : index;
  }

  getReviewerQueue(author, count = 5) {
    return this.selectReviewer(author, count);
  }

  // For stats display - simplified version
  calculateReviewStats() {
    const recentApprovals = this.getRecentApprovals();
    const pendingReviews = this.getPendingReviews();
    const cfg = config.get();
    const team = cfg.team || [];
    
    const stats = {};
    
    team.forEach(member => {
      if (!member.includes('[bot]')) {
        const memberApprovals = recentApprovals.filter(a => a.reviewer === member);
        
        stats[member] = {
          recentApprovals: memberApprovals.length,
          lastApprovalDate: memberApprovals.length > 0 ? memberApprovals[0].date : null,
          pendingReviews: pendingReviews[member] || 0
        };
      }
    });
    
    return stats;
  }
}

module.exports = ReviewerSelector;