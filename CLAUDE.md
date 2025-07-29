# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a CLI tool called "review" that automatically selects the next code reviewer for pull requests based on historical review data, ensuring fair rotation and workload distribution. It integrates with GitHub CLI (`gh`) and uses a weighted scoring algorithm to elect reviewers.

## Commands

### Development & Testing
- Run tests: `npm test` 
- Run specific test file: `npm test path/to/test.js`
- Start CLI locally: `node src/cli.js <command>`

### CLI Commands
- `review init` - Initialize configuration file (`.pr-reviewer.yml`)
- `review elect [--pr <number>] [--auto-assign]` - Elect reviewer for PR
- `review stats [--days <number>]` - Show review statistics
- `review next [--count <number>] [--verbose]` - Preview next reviewers
- `review unavailable <username> [--until <date>] [--remove]` - Manage availability

## Architecture

### Core Components
- **CLI Entry Point**: `src/cli.js` - Commander-based CLI interface
- **Commands**: Individual command modules in `src/commands/`
  - `elect.js` - Main reviewer election logic
  - `stats.js` - Review statistics visualization  
  - `next.js` - Preview next reviewers without changes
  - `init.js` - Configuration initialization
  - `unavailable.js` - Team member availability management

### Libraries
- **Config Management**: `src/lib/config.js` - Handles `.pr-reviewer.yml` loading/saving
- **GitHub Integration**: `src/lib/github.js` - Interfaces with GitHub CLI (`gh`)
- **Reviewer Selection**: `src/lib/reviewer-selector.js` - Core scoring algorithm

### Selection Algorithm
The `ReviewerSelector` class uses a simple algorithm focused on approval rotation:
- Analyzes the last N PRs (default: 30) for approval patterns
- Prioritizes reviewers with fewer recent approvals
- Breaks ties by who approved longest ago
- Applies workload penalties for pending reviews

### Configuration File Structure
`.pr-reviewer.yml` contains:
- `team` - Array of eligible reviewers
- `excluded` - Bot accounts to ignore
- `lookbackPRs` - Number of recent PRs to analyze (default: 30)
- `maxPendingReviews` - Workload threshold (default: 3)
- `unavailable` - Temporary unavailability records

### Key Dependencies
- `commander` - CLI framework
- `js-yaml` - Configuration file parsing
- `chalk` - Terminal styling
- `cli-table3` - Table formatting
- `inquirer` - Interactive prompts
- `date-fns` - Date calculations