# Review - PR Reviewer Election Tool

A command-line tool that automatically selects the next code reviewer for pull requests based on historical review data, ensuring fair rotation and workload distribution.

## Features

- 🔄 **Fair Rotation**: Automatically selects reviewers based on who hasn't reviewed recently
- ⚖️ **Load Balancing**: Considers current workload and historical review counts
- 📊 **Statistics**: View team review statistics and patterns
- 🚫 **Availability Management**: Mark team members as unavailable for time off
- ⚡ **GitHub Integration**: Works seamlessly with GitHub CLI (`gh`)
- 🎨 **Beautiful CLI**: Colorful, interactive terminal interface

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd review

# Install dependencies
npm install

# Make the CLI globally available
npm link
```

## Prerequisites

- Node.js >= 14.0.0
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
- Git repository with GitHub remote

## Quick Start

```bash
# Initialize configuration in your repository
review init

# Elect a reviewer for the current branch's PR
review elect

# View review statistics
review stats

# See who's next in the queue
review next
```

## Commands

### `review init`
Initialize the reviewer configuration for your repository. This command will:
- Detect team members from recent PR history
- Create `.pr-reviewer.yml` configuration file
- Set up scoring weights and preferences

### `review elect [options]`
Elect a reviewer for a pull request.

Options:
- `-p, --pr <number>`: PR number to elect reviewer for (defaults to current branch's PR)
- `-a, --auto-assign`: Automatically assign the elected reviewer

```bash
# Elect for current branch's PR
review elect

# Elect for specific PR and auto-assign
review elect --pr 123 --auto-assign
```

### `review stats [options]`
Display review statistics for the team.

Options:
- `-d, --days <number>`: Number of days to show stats for (default: 30)

```bash
# Show stats for last 30 days
review stats

# Show stats for last 90 days
review stats --days 90
```

### `review next [options]`
Show who's next in line for review without making any changes.

Options:
- `-n, --count <number>`: Number of reviewers to show (default: 3)

### `review unavailable <username> [options]`
Mark a team member as unavailable.

Options:
- `-u, --until <date>`: Date until unavailable (YYYY-MM-DD)
- `-r, --remove`: Remove unavailability

```bash
# Mark someone unavailable until a date
review unavailable alice --until 2024-12-25

# Mark someone unavailable indefinitely
review unavailable bob

# Mark someone as available again
review unavailable alice --remove
```

## Configuration

The tool uses a `.pr-reviewer.yml` file in your repository root:

```yaml
# Team members eligible for review
team:
  - alice
  - bob
  - charlie
  - david

# Excluded users (bots, external contributors)
excluded:
  - dependabot[bot]
  - github-actions[bot]

# Scoring weights
weights:
  recency: 3      # Days since last review
  balance: 2      # Review count balance
  workload: 1     # Current pending reviews

# Review history window (days)
historyDays: 30

# Maximum pending reviews before deprioritizing
maxPendingReviews: 3

# Unavailable team members
unavailable:
  alice:
    since: "2024-01-15T10:00:00Z"
    until: "2024-01-20T10:00:00Z"
```

## Scoring Algorithm

The tool uses a weighted scoring system to select reviewers:

1. **Recency** (highest weight): Prefers reviewers who haven't reviewed in the longest time
2. **Balance**: Distributes reviews evenly across the team
3. **Workload**: Deprioritizes reviewers with many pending reviews

Score = (Days Since Last Review × Recency Weight) + (Average Reviews - Reviewer Count × Balance Weight) - (Pending Reviews × Workload Weight)

## Development

```bash
# Run tests
npm test

# Run the CLI locally
node src/cli.js <command>

# Watch for changes
npm run dev
```

## License

MIT