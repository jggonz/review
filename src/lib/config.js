const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

class Config {
  constructor() {
    this.configPath = path.join(process.cwd(), '.pr-reviewer.yml');
    this.config = this.load();
  }

  load() {
    if (!fs.existsSync(this.configPath)) {
      return this.getDefaults();
    }

    try {
      const fileContents = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(fileContents);
      return { ...this.getDefaults(), ...config };
    } catch (error) {
      console.error(chalk.yellow('Warning: Error loading config file, using defaults'));
      return this.getDefaults();
    }
  }

  save(config) {
    try {
      const yamlStr = yaml.dump(config, { indent: 2 });
      fs.writeFileSync(this.configPath, yamlStr, 'utf8');
      this.config = config;
      return true;
    } catch (error) {
      console.error(chalk.red('Error saving config:', error.message));
      return false;
    }
  }

  getDefaults() {
    return {
      team: [],
      excluded: ['dependabot[bot]', 'github-actions[bot]'],
      lookbackPRs: 10,        // Number of recent PRs to analyze for approval patterns
      maxPendingReviews: 3,   // Max pending reviews before reviewer is deprioritized
      unavailable: {}
    };
  }

  get(key) {
    return key ? this.config[key] : this.config;
  }

  set(key, value) {
    this.config[key] = value;
    return this.save(this.config);
  }

  isUnavailable(username) {
    const unavailable = this.config.unavailable[username];
    if (!unavailable) return false;
    
    if (unavailable.until) {
      const until = new Date(unavailable.until);
      return until > new Date();
    }
    
    return true;
  }

  setUnavailable(username, until = null) {
    if (!this.config.unavailable) {
      this.config.unavailable = {};
    }
    
    this.config.unavailable[username] = {
      since: new Date().toISOString(),
      until: until
    };
    
    return this.save(this.config);
  }

  setAvailable(username) {
    if (this.config.unavailable) {
      delete this.config.unavailable[username];
      return this.save(this.config);
    }
    return true;
  }

  exists() {
    return fs.existsSync(this.configPath);
  }
}

module.exports = new Config();