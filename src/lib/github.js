const { execSync } = require('child_process');
const chalk = require('chalk');

class GitHubAPI {
  constructor() {
    this.checkGHCLI();
  }

  checkGHCLI() {
    try {
      execSync('gh --version', { stdio: 'ignore' });
    } catch (error) {
      console.error(chalk.red('Error: GitHub CLI (gh) is not installed or not in PATH'));
      console.error(chalk.yellow('Please install it from: https://cli.github.com/'));
      process.exit(1);
    }

    try {
      execSync('gh auth status', { stdio: 'ignore' });
    } catch (error) {
      console.error(chalk.red('Error: Not authenticated with GitHub'));
      console.error(chalk.yellow('Please run: gh auth login'));
      process.exit(1);
    }
  }

  getCurrentRepo() {
    try {
      const output = execSync('gh repo view --json nameWithOwner', { encoding: 'utf8' });
      return JSON.parse(output).nameWithOwner;
    } catch (error) {
      console.error(chalk.red('Error: Not in a GitHub repository'));
      process.exit(1);
    }
  }

  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error(chalk.red('Error: Unable to get current branch'));
      process.exit(1);
    }
  }

  getPRHistory(days = 90, limit = 200) {
    try {
      const output = execSync(
        `gh pr list --state closed --limit ${limit} --json number,author,reviewRequests,reviews,closedAt,createdAt,title`,
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const prs = JSON.parse(output);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      return prs.filter(pr => {
        const closedDate = new Date(pr.closedAt);
        return closedDate >= cutoffDate;
      });
    } catch (error) {
      console.error(chalk.red('Error fetching PR history:', error.message));
      return [];
    }
  }

  getOpenPRs() {
    try {
      const output = execSync(
        'gh pr list --state open --json number,author,reviewRequests,title,createdAt',
        { encoding: 'utf8' }
      );
      return JSON.parse(output);
    } catch (error) {
      console.error(chalk.red('Error fetching open PRs:', error.message));
      return [];
    }
  }

  getPR(prNumber) {
    try {
      const output = execSync(
        `gh pr view ${prNumber} --json number,author,reviewRequests,title,state`,
        { encoding: 'utf8' }
      );
      return JSON.parse(output);
    } catch (error) {
      console.error(chalk.red(`Error fetching PR #${prNumber}:`, error.message));
      return null;
    }
  }

  getCurrentPR() {
    try {
      const branch = this.getCurrentBranch();
      const output = execSync(
        `gh pr list --head ${branch} --json number,author,reviewRequests,title,state`,
        { encoding: 'utf8' }
      );
      const prs = JSON.parse(output);
      return prs.length > 0 ? prs[0] : null;
    } catch (error) {
      return null;
    }
  }

  assignReviewer(prNumber, reviewer) {
    try {
      execSync(`gh pr edit ${prNumber} --add-reviewer ${reviewer}`, { stdio: 'inherit' });
      return true;
    } catch (error) {
      console.error(chalk.red(`Error assigning reviewer:`, error.message));
      return false;
    }
  }

  getTeamMembers() {
    const prs = this.getPRHistory(90, 300);
    const members = new Set();
    
    prs.forEach(pr => {
      if (pr.author?.login) {
        members.add(pr.author.login);
      }
      
      pr.reviewRequests?.forEach(req => {
        if (req.login) {
          members.add(req.login);
        }
      });
      
      pr.reviews?.forEach(review => {
        if (review.author?.login) {
          members.add(review.author.login);
        }
      });
    });
    
    return Array.from(members).filter(m => !m.includes('[bot]'));
  }
}

module.exports = new GitHubAPI();