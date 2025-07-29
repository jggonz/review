const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const github = require('../lib/github');
const config = require('../lib/config');
const ReviewerSelector = require('../lib/reviewer-selector');

async function stats(options) {
  const spinner = ora('Gathering review statistics...').start();
  
  try {
    const days = parseInt(options.days) || 30;
    const prHistory = github.getPRHistory(days);
    const openPRs = github.getOpenPRs();
    
    if (prHistory.length === 0) {
      spinner.fail('No PR history found');
      return;
    }
    
    const selector = new ReviewerSelector(prHistory, openPRs);
    const reviewStats = selector.calculateReviewStats();
    
    spinner.succeed(`Review statistics for the last ${days} days`);
    
    const table = new Table({
      head: [
        chalk.bold('Reviewer'),
        chalk.bold('Recent Approvals'),
        chalk.bold('Pending'),
        chalk.bold('Last Approval'),
        chalk.bold('Status')
      ],
      colWidths: [20, 18, 10, 15, 15],
      style: {
        head: ['cyan']
      }
    });
    
    const cfg = config.get();
    const lookbackPRs = cfg.lookbackPRs || 30;
    
    const sortedReviewers = Object.entries(reviewStats)
      .filter(([reviewer]) => !reviewer.includes('[bot]'))
      .sort((a, b) => a[1].recentApprovals - b[1].recentApprovals); // Sort by fewest approvals first
    
    const totalApprovals = sortedReviewers.reduce((sum, [, stats]) => sum + stats.recentApprovals, 0);
    
    sortedReviewers.forEach(([reviewer, stats]) => {
      const lastApproval = !stats.lastApprovalDate
        ? chalk.gray('Never') 
        : new Date().toDateString() === stats.lastApprovalDate.toDateString()
          ? chalk.green('Today')
          : chalk.yellow(`${Math.floor((new Date() - stats.lastApprovalDate) / (1000 * 60 * 60 * 24))}d ago`);
      
      const pendingColor = stats.pendingReviews > 2 ? 'red' : stats.pendingReviews > 0 ? 'yellow' : 'gray';
      
      let status = chalk.green('Available');
      if (config.isUnavailable(reviewer)) {
        status = chalk.red('Unavailable');
      } else if (stats.pendingReviews >= (cfg.maxPendingReviews || 3)) {
        status = chalk.red('Overloaded');
      } else if (stats.recentApprovals === 0) {
        status = chalk.cyan('Next up');
      }
      
      table.push([
        '@' + reviewer,
        `${stats.recentApprovals}/${lookbackPRs} PRs`,
        chalk[pendingColor](stats.pendingReviews),
        lastApproval,
        status
      ]);
    });
    
    console.log('\n' + table.toString());
    
    console.log(chalk.dim('\n📊 Summary:'));
    console.log(chalk.dim(`   Total approvals in last ${lookbackPRs} PRs: ${totalApprovals}`));
    console.log(chalk.dim(`   Team members: ${sortedReviewers.length}`));
    console.log(chalk.dim(`   Average approvals per person: ${(totalApprovals / sortedReviewers.length || 0).toFixed(1)}`));
    console.log(chalk.dim(`   PRs analyzed: ${Math.min(prHistory.length, lookbackPRs)}`));
    
    const unavailable = Object.entries(config.get('unavailable') || {})
      .filter(([, data]) => !data.until || new Date(data.until) > new Date());
    
    if (unavailable.length > 0) {
      console.log(chalk.red('\n⚠️  Unavailable reviewers:'));
      unavailable.forEach(([username, data]) => {
        const until = data.until ? ` until ${new Date(data.until).toLocaleDateString()}` : '';
        console.log(chalk.red(`   - @${username}${until}`));
      });
    }
    
  } catch (error) {
    spinner.fail('Error: ' + error.message);
    process.exit(1);
  }
}

module.exports = { stats };