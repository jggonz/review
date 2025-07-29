const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const boxen = require('boxen');
const github = require('../lib/github');
const config = require('../lib/config');
const ReviewerSelector = require('../lib/reviewer-selector');

async function elect(options) {
  const spinner = ora('Fetching PR data...').start();
  
  try {
    let pr;
    if (options.pr) {
      pr = github.getPR(options.pr);
      if (!pr) {
        spinner.fail(`PR #${options.pr} not found`);
        return;
      }
    } else {
      pr = github.getCurrentPR();
      if (!pr) {
        spinner.fail('No PR found for current branch');
        console.log(chalk.yellow('\nTip: Create a PR first or use --pr flag to specify PR number'));
        return;
      }
    }
    
    if (pr.state !== 'OPEN') {
      spinner.fail(`PR #${pr.number} is not open`);
      return;
    }
    
    spinner.text = 'Analyzing review history...';
    
    const prHistory = github.getPRHistory(config.get('historyDays') || 30);
    const openPRs = github.getOpenPRs();
    
    const selector = new ReviewerSelector(prHistory, openPRs);
    const result = selector.selectReviewer(pr.author.login);
    
    if (!result) {
      spinner.fail('No eligible reviewers found');
      console.log(chalk.yellow('\nPossible reasons:'));
      console.log(chalk.yellow('- All team members are unavailable'));
      console.log(chalk.yellow('- No team members configured'));
      console.log(chalk.yellow('- All reviewers have too many pending reviews'));
      return;
    }
    
    spinner.succeed('Analysis complete');
    
    console.log(boxen(
      `${chalk.bold('Selected Reviewer:')} ${chalk.green('@' + result.reviewer)}\n\n` +
      `${chalk.bold('PR:')} #${pr.number} - ${pr.title}\n` +
      `${chalk.bold('Author:')} @${pr.author.login}\n\n` +
      `${chalk.dim('Review Stats:')}\n` +
      `  Last reviewed: ${result.stats.daysSinceLastReview === Infinity ? 'Never' : result.stats.daysSinceLastReview + ' days ago'}\n` +
      `  Total reviews: ${result.stats.totalReviews} (avg: ${selector.getAverageReviews().toFixed(1)})\n` +
      `  Approvals: ${result.stats.totalApprovals || 0} (avg: ${selector.getAverageApprovals().toFixed(1)})\n` +
      `  Pending reviews: ${result.stats.pendingReviews}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    ));
    
    const shouldAssign = options.autoAssign || (await promptAssignment());
    
    if (shouldAssign) {
      const assignSpinner = ora('Assigning reviewer...').start();
      const success = github.assignReviewer(pr.number, result.reviewer);
      
      if (success) {
        assignSpinner.succeed(`Assigned @${result.reviewer} to PR #${pr.number}`);
      } else {
        assignSpinner.fail('Failed to assign reviewer');
      }
    }
    
  } catch (error) {
    spinner.fail('Error: ' + error.message);
    process.exit(1);
  }
}

async function promptAssignment() {
  const { shouldAssign } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldAssign',
      message: 'Would you like to assign this reviewer automatically?',
      default: false
    }
  ]);
  return shouldAssign;
}

module.exports = { elect };