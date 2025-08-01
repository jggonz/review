const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const { default: open } = require('open');
const github = require('../lib/github');

async function mine(options) {
  const spinner = ora('Fetching PRs...').start();
  
  try {
    const username = github.getCurrentUser();
    if (!username) {
      spinner.fail('Could not determine current user');
      return;
    }

    const myPRs = github.getUserPRs(username);
    const reviewPRs = github.getPRsToReview(username);
    
    spinner.succeed('PRs loaded');

    let mode = 'created'; // 'created' or 'reviewing'
    let exitLoop = false;

    while (!exitLoop) {
      console.clear();
      
      const prs = mode === 'created' ? myPRs : reviewPRs;
      const modeDisplay = mode === 'created' ? 'Created by you' : 'Awaiting your review';
      
      console.log(chalk.bold.cyan(`\n📋 Pull Requests - ${modeDisplay}\n`));
      
      if (!prs || prs.length === 0) {
        console.log(chalk.gray(`No PRs found in this category.\n`));
      }

      const choices = prs.map(pr => ({
        name: formatPRChoice(pr, mode),
        value: pr.url
      }));

      // Add mode switching option
      choices.push(new inquirer.Separator());
      choices.push({
        name: chalk.yellow(`↔️  Switch to ${mode === 'created' ? 'PRs to review' : 'PRs you created'}`),
        value: 'switch_mode'
      });
      choices.push({
        name: chalk.gray('Exit'),
        value: 'exit'
      });

      console.log(chalk.gray('Use arrow keys to navigate, Enter to select\n'));

      const { selectedOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedOption',
          message: `Select a PR or action:`,
          choices,
          pageSize: 15,
          loop: false
        }
      ]);

      if (selectedOption === 'exit') {
        exitLoop = true;
        console.log(chalk.gray('\nExited'));
      } else if (selectedOption === 'switch_mode') {
        mode = mode === 'created' ? 'reviewing' : 'created';
      } else if (selectedOption) {
        await open(selectedOption);
        console.log(chalk.green('\n✓ Opened PR in browser'));
        
        // Ask if user wants to continue
        const { continueViewing } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueViewing',
            message: 'Continue browsing PRs?',
            default: true
          }
        ]);
        
        if (!continueViewing) {
          exitLoop = true;
        }
      }
    }

  } catch (error) {
    if (error.isTtyError) {
      spinner.fail('Interactive mode not supported in this environment');
    } else if (error.name === 'ExitPromptError' || error.message === 'User force closed the prompt') {
      console.log(chalk.gray('\nExited'));
    } else {
      spinner.fail(`Error: ${error.message}`);
    }
  }
}

function formatPRChoice(pr, mode) {
  const title = pr.title.length > 50 ? pr.title.substring(0, 47) + '...' : pr.title;
  const number = chalk.bold(`#${pr.number}`);
  
  if (mode === 'created') {
    const repo = pr.headRepository ? pr.headRepository.name : 'unknown';
    const reviews = pr.reviewDecision ? 
      pr.reviewDecision === 'APPROVED' ? chalk.green('✓ Approved') : 
      pr.reviewDecision === 'CHANGES_REQUESTED' ? chalk.red('✗ Changes requested') : 
      chalk.yellow('○ Pending review') : chalk.gray('○ No reviews');
    
    return `${number} ${title} ${chalk.gray(`(${repo})`)} ${reviews}`;
  } else {
    const repo = pr.repository ? pr.repository.name : 'unknown';
    const author = pr.author ? pr.author.login : 'unknown';
    
    return `${number} ${title} ${chalk.gray(`by ${author} in ${repo}`)}`;
  }
}

module.exports = mine;