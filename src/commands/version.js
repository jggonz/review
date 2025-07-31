const chalk = require('chalk');
const boxen = require('boxen');
const packageJson = require('../../package.json');

function version() {
  const versionInfo = [
    `${chalk.bold('Review')} ${chalk.green(`v${packageJson.version}`)}`,
    '',
    chalk.gray(packageJson.description),
    '',
    `${chalk.bold('Node.js:')} ${process.version}`,
    `${chalk.bold('Platform:')} ${process.platform}`,
  ].join('\n');

  console.log(boxen(versionInfo, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue'
  }));
}

module.exports = { version };