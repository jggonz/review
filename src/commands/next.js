const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const github = require('../lib/github');
const config = require('../lib/config');
const ReviewerSelector = require('../lib/reviewer-selector');

async function next(options) {
  const spinner = ora('Analyzing review queue...').start();
  
  try {
    const count = parseInt(options.count) || 3;
    const prHistory = github.getPRHistory(config.get('historyDays') || 30);
    const openPRs = github.getOpenPRs();
    
    const selector = new ReviewerSelector(prHistory, openPRs);
    // Don't pass an author - we want to see the general queue
    const queue = selector.getReviewerQueue(null, count);
    
    if (!queue || queue.length === 0) {
      spinner.fail('No eligible reviewers found');
      return;
    }
    
    spinner.succeed('Review queue analyzed');
    
    console.log(boxen(
      chalk.bold('📊 Next Reviewers in Queue\n\n') +
      queue.map((item, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const lastReview = item.stats.daysSinceLastReview === Infinity 
          ? 'Never reviewed' 
          : `Last reviewed ${item.stats.daysSinceLastReview} days ago`;
        
        return `${emoji} ${chalk.green('@' + item.reviewer)} ${chalk.dim(`(score: ${item.score.toFixed(1)})`)}
   ${chalk.gray(lastReview)}
   ${chalk.gray(`${item.stats.totalReviews} reviews (${item.stats.totalApprovals || 0} approvals) | ${item.stats.pendingReviews} pending`)}`;
      }).join('\n\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));
    
    if (options.verbose) {
      console.log(chalk.dim('\nScore breakdown for top reviewer:'));
      const top = queue[0];
      console.log(chalk.dim(`  Recency bonus: +${top.breakdown.recency.toFixed(1)}`));
      console.log(chalk.dim(`  Balance bonus: ${top.breakdown.balance > 0 ? '+' : ''}${top.breakdown.balance.toFixed(1)}`));
      if (top.breakdown.approvals !== 0) {
        console.log(chalk.dim(`  Approval balance: ${top.breakdown.approvals > 0 ? '+' : ''}${top.breakdown.approvals.toFixed(1)}`));
      }
      console.log(chalk.dim(`  Workload penalty: ${top.breakdown.workload.toFixed(1)}`));
    }
    
  } catch (error) {
    spinner.fail('Error: ' + error.message);
    process.exit(1);
  }
}

async function getCurrentUser() {
  try {
    const { execSync } = require('child_process');
    const output = execSync('gh api user --jq .login', { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    return 'current-user';
  }
}

module.exports = { next };