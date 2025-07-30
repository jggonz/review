#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { elect } = require('./commands/elect');
const { stats } = require('./commands/stats');
const { next } = require('./commands/next');
const { unavailable } = require('./commands/unavailable');
const { init } = require('./commands/init');
const { version } = require('./commands/version');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('review')
  .description('PR reviewer election tool for fair code review rotation')
  .version(packageJson.version);

program
  .command('elect')
  .description('Elect a reviewer for a PR')
  .option('-p, --pr <number>', 'PR number to elect reviewer for')
  .option('-a, --auto-assign', 'Automatically assign the elected reviewer')
  .action(elect);

program
  .command('stats')
  .description('Show review statistics')
  .option('-d, --days <number>', 'Number of days to show stats for', '30')
  .action(stats);

program
  .command('next')
  .description('Show who\'s next in line for review (dry run)')
  .option('-n, --count <number>', 'Number of reviewers to show', '10')
  .option('-v, --verbose', 'Show detailed score breakdown')
  .action(next);

program
  .command('unavailable <username>')
  .description('Mark a team member as unavailable')
  .option('-u, --until <date>', 'Date until unavailable (YYYY-MM-DD)')
  .option('-r, --remove', 'Remove unavailability')
  .action(unavailable);

program
  .command('init')
  .description('Initialize review configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(init);

program
  .command('version')
  .description('Show version information')
  .action(version);

program.parse();