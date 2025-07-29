const chalk = require('chalk');
const config = require('../lib/config');
const { parseISO, format, isValid } = require('date-fns');

async function unavailable(username, options) {
  username = username.replace('@', '');
  
  if (options.remove) {
    const success = config.setAvailable(username);
    if (success) {
      console.log(chalk.green(`✅ @${username} marked as available`));
    } else {
      console.log(chalk.red(`❌ Failed to update availability`));
    }
    return;
  }
  
  let until = null;
  if (options.until) {
    const date = parseISO(options.until);
    if (!isValid(date)) {
      console.log(chalk.red(`❌ Invalid date format. Please use YYYY-MM-DD`));
      return;
    }
    if (date < new Date()) {
      console.log(chalk.red(`❌ Date must be in the future`));
      return;
    }
    until = date.toISOString();
  }
  
  const success = config.setUnavailable(username, until);
  
  if (success) {
    const message = until 
      ? `✅ @${username} marked as unavailable until ${format(parseISO(until), 'MMM dd, yyyy')}`
      : `✅ @${username} marked as unavailable indefinitely`;
    console.log(chalk.green(message));
    console.log(chalk.dim(`\nUse --remove flag to mark as available again`));
  } else {
    console.log(chalk.red(`❌ Failed to update availability`));
  }
}

module.exports = { unavailable };