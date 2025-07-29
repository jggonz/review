const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const config = require('../lib/config');
const github = require('../lib/github');

async function init(options) {
  if (config.exists() && !options.force) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration file already exists. Overwrite?',
        default: false
      }
    ]);
    
    if (!overwrite) {
      console.log(chalk.yellow('Initialization cancelled'));
      return;
    }
  }
  
  const spinner = ora('Detecting team members from PR history...').start();
  
  try {
    const detectedMembers = github.getTeamMembers();
    spinner.succeed(`Detected ${detectedMembers.length} team members from recent PR history`);
    
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'team',
        message: 'Select team members to include in reviewer rotation:',
        choices: detectedMembers.map(member => ({
          name: `@${member}`,
          value: member,
          checked: true
        })),
        validate: (input) => input.length > 0 || 'Please select at least one team member'
      },
      {
        type: 'input',
        name: 'additionalMembers',
        message: 'Add additional team members (comma-separated usernames):',
        filter: (input) => input.split(',').map(s => s.trim()).filter(Boolean)
      },
      {
        type: 'number',
        name: 'historyDays',
        message: 'Number of days of PR history to consider:',
        default: 30,
        validate: (input) => input > 0 && input <= 365 || 'Please enter a value between 1 and 365'
      },
      {
        type: 'number',
        name: 'maxPendingReviews',
        message: 'Maximum pending reviews before deprioritizing reviewer:',
        default: 3,
        validate: (input) => input >= 0 || 'Please enter a non-negative number'
      },
      {
        type: 'confirm',
        name: 'customWeights',
        message: 'Would you like to customize scoring weights?',
        default: false
      }
    ]);
    
    let weights = config.getDefaults().weights;
    
    if (answers.customWeights) {
      const weightAnswers = await inquirer.prompt([
        {
          type: 'number',
          name: 'recency',
          message: 'Weight for recency (days since last review):',
          default: weights.recency,
          validate: (input) => input >= 0 || 'Weight must be non-negative'
        },
        {
          type: 'number',
          name: 'balance',
          message: 'Weight for review count balance:',
          default: weights.balance,
          validate: (input) => input >= 0 || 'Weight must be non-negative'
        },
        {
          type: 'number',
          name: 'approvals',
          message: 'Weight for approval count balance (prioritizes active approvers):',
          default: weights.approvals || 3,
          validate: (input) => input >= 0 || 'Weight must be non-negative'
        },
        {
          type: 'number',
          name: 'workload',
          message: 'Weight for current workload (pending reviews):',
          default: weights.workload,
          validate: (input) => input >= 0 || 'Weight must be non-negative'
        }
      ]);
      weights = weightAnswers;
    }
    
    const allTeamMembers = [...new Set([...answers.team, ...answers.additionalMembers])];
    
    const newConfig = {
      ...config.getDefaults(),
      team: allTeamMembers,
      historyDays: answers.historyDays,
      maxPendingReviews: answers.maxPendingReviews,
      weights: weights
    };
    
    const success = config.save(newConfig);
    
    if (success) {
      console.log(chalk.green('\n✅ Configuration saved to .pr-reviewer.yml'));
      console.log(chalk.dim('\nConfiguration summary:'));
      console.log(chalk.dim(`  • ${allTeamMembers.length} team members`));
      console.log(chalk.dim(`  • ${answers.historyDays} days of history`));
      console.log(chalk.dim(`  • Max ${answers.maxPendingReviews} pending reviews`));
      console.log(chalk.dim(`  • Weights: recency=${weights.recency}, balance=${weights.balance}, approvals=${weights.approvals}, workload=${weights.workload}`));
      
      console.log(chalk.cyan('\n🎉 You\'re all set! Try these commands:'));
      console.log(chalk.cyan('  review next      - See who\'s next in the queue'));
      console.log(chalk.cyan('  review elect     - Elect a reviewer for current PR'));
      console.log(chalk.cyan('  review stats     - View review statistics'));
    } else {
      console.log(chalk.red('❌ Failed to save configuration'));
    }
    
  } catch (error) {
    spinner.fail('Error: ' + error.message);
    process.exit(1);
  }
}

module.exports = { init };