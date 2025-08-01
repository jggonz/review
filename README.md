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

### `review init [options]`
Initialize the reviewer configuration for your repository. This command will:
- Detect team members from recent PR history
- Create `.pr-reviewer.yml` configuration file
- Set up scoring weights and preferences

Options:
- `-f, --force`: Overwrite existing configuration

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
- `-n, --count <number>`: Number of reviewers to show (default: 10)
- `-v, --verbose`: Show detailed score breakdown

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

### `review version`
Display version information about the tool, including:
- Current version number
- Tool description
- Node.js version
- Platform information

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

# Configuration settings
lookbackPRs: 30         # Number of recent PRs to analyze for approval patterns
maxPendingReviews: 3    # Max pending reviews before reviewer is deprioritized


# Unavailable team members
unavailable:
  alice:
    since: "2024-01-15T10:00:00Z"
    until: "2024-01-20T10:00:00Z"
```

## Selection Algorithm

The tool uses a simple, transparent algorithm focused on minimizing repeats and load balancing approvals:

1. **Looks at the last N PRs** (default: 30) to see who has been approving recently
2. **Prioritizes reviewers with fewer recent approvals** - if someone hasn't approved any of the last 30 PRs, they get top priority
3. **Breaks ties by recency** - among reviewers with the same approval count, picks who approved longest ago
4. **Considers current workload** - adds penalty for pending reviews, heavy penalty for exceeding max pending reviews

This simple approach ensures fair rotation of approvals (not just comments) and prevents the same people from always being selected while others are skipped.

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