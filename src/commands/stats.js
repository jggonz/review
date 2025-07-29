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
    const reviewStats = selector.reviewStats;
    
    spinner.succeed(`Review statistics for the last ${days} days`);
    
    const table = new Table({
      head: [
        chalk.bold('Reviewer'),
        chalk.bold('Reviews'),
        chalk.bold('Pending'),
        chalk.bold('Last Review'),
        chalk.bold('Avg/Week')
      ],
      colWidths: [20, 10, 10, 15, 12],
      style: {
        head: ['cyan']
      }
    });
    
    const sortedReviewers = Object.entries(reviewStats)
      .filter(([reviewer]) => !reviewer.includes('[bot]'))
      .sort((a, b) => b[1].totalReviews - a[1].totalReviews);
    
    const totalReviews = sortedReviewers.reduce((sum, [, stats]) => sum + stats.totalReviews, 0);
    const avgReviews = totalReviews / sortedReviewers.length || 0;
    
    sortedReviewers.forEach(([reviewer, stats]) => {
      const reviewsPerWeek = (stats.totalReviews / (days / 7)).toFixed(1);
      const lastReview = stats.daysSinceLastReview === Infinity 
        ? chalk.gray('Never') 
        : stats.daysSinceLastReview === 0 
          ? chalk.green('Today')
          : chalk.yellow(`${stats.daysSinceLastReview}d ago`);
      
      const pendingColor = stats.pendingReviews > 2 ? 'red' : stats.pendingReviews > 0 ? 'yellow' : 'gray';
      
      table.push([
        '@' + reviewer,
        stats.totalReviews,
        chalk[pendingColor](stats.pendingReviews),
        lastReview,
        reviewsPerWeek
      ]);
    });
    
    console.log('\n' + table.toString());
    
    console.log(chalk.dim('\n📊 Summary:'));
    console.log(chalk.dim(`   Total reviews: ${totalReviews}`));
    console.log(chalk.dim(`   Active reviewers: ${sortedReviewers.length}`));
    console.log(chalk.dim(`   Average reviews per person: ${avgReviews.toFixed(1)}`));
    console.log(chalk.dim(`   PRs analyzed: ${prHistory.length}`));
    
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