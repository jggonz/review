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
    const prHistory = github.getPRHistory(30); // Get enough history to analyze patterns
    const openPRs = github.getOpenPRs();
    
    const selector = new ReviewerSelector(prHistory, openPRs);
    // Don't pass an author - we want to see the general queue
    const queue = selector.getReviewerQueue(null, count);
    
    if (!queue || queue.length === 0) {
      spinner.fail('No eligible reviewers found');
      return;
    }
    
    spinner.succeed('Review queue analyzed');
    
    const cfg = config.get();
    const lookbackPRs = cfg.lookbackPRs || 10;
    
    console.log(boxen(
      chalk.bold('📊 Next Reviewers in Queue\n\n') +
      queue.map((item, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const lastApprovalIndex = item.stats.lastApprovalIndex;
        const approvalStatus = lastApprovalIndex >= lookbackPRs 
          ? chalk.red('No recent approvals') 
          : lastApprovalIndex === 0
            ? chalk.green('Approved most recent PR')
            : chalk.yellow(`Last approval: ${lastApprovalIndex + 1} PRs ago`);
        
        return `${emoji} ${chalk.green('@' + item.reviewer)} ${chalk.dim(`(score: ${item.score})`)}
   ${chalk.gray(approvalStatus)}
   ${chalk.gray(`${item.stats.recentApprovals}/${lookbackPRs} recent approvals | ${item.stats.pendingReviews} pending`)}`;
      }).join('\n\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    ));
    
    if (options.verbose) {
      console.log(chalk.dim('\nSimple scoring logic:'));
      console.log(chalk.dim('• Reviewers with fewer recent approvals get priority'));
      console.log(chalk.dim('• Ties broken by who approved longest ago'));
      console.log(chalk.dim('• Heavy penalty for exceeding max pending reviews'));
      console.log(chalk.dim(`• Analysis window: last ${lookbackPRs} PRs`));
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