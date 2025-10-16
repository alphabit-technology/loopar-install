#!/usr/bin/env node

/**
 * looopar-install.js
 */

const { Command } = require('commander');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const portfinder = require('portfinder');

const program = new Command();

// Default repository to clone when folder doesn't exist.
// Keep your original default URL here.
const DEFAULT_REPO = 'https://github.com/alphabit-technology/loopar-framework.git';

/**
 * runCommand
 * Run a synchronous shell command and inherit stdio so the user sees output.
 * envOverride will be merged on top of process.env for cross-platform safety.
 */
function runCommand(command, options = {}) {
  const { cwd = process.cwd(), envOverride = {} } = options;
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...envOverride },
    });
  } catch (err) {
    throw new Error(`Command failed: "${command}"\n${err.message}`);
  }
}

/**
 * ensureYarn
 * Make sure Yarn is available. If not, try to install globally via npm.
 */
function ensureYarn() {
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    console.log('Yarn is already installed.');
  } catch {
    console.log('Yarn is not installed. Installing Yarn globally via npm...');
    try {
      execSync('npm install -g yarn', { stdio: 'inherit' });
      console.log('Yarn installed.');
    } catch (err) {
      throw new Error('Failed to install Yarn. Please install it manually.');
    }
  }
}

/**
 * gitCliAvailable
 * Check whether the git CLI is installed.
 */
function gitCliAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * cloneRepo
 * Use git CLI to clone the repository into targetPath.
 * `git clone <repo> <target>` will create the target directory.
 */
async function cloneRepo(repoUrl, targetPath) {
  if (!gitCliAvailable()) {
    throw new Error('git CLI not found. Please install Git to use this script.');
  }

  try {
    runCommand(`git clone ${repoUrl} ${targetPath}`);
  } catch (err) {
    throw new Error(`git clone failed: ${err.message}`);
  }
}

program
  .argument('<folderName>', 'Name of the folder to create or use if it exists')
  .option('-p, --port <number>', 'Preconfigured port number', '3000')
  .option('--skip-install', 'Skip running yarn install (useful for fast tests)')
  .action(async (folderName, options) => {
    try {
      // Step 1: Ensure Yarn is installed (unless user requested skip-install)
      if (!options.skipInstall) ensureYarn();

      // Resolve target path
      const targetPath = path.resolve(process.cwd(), folderName);
      const folderExists = fs.existsSync(targetPath);

      if (folderExists) {
        console.log(`Folder already exists: ${targetPath}. Skipping clone.`);
      } else {
        // Clone default repo into targetPath
        console.log(`Folder does not exist. Cloning ${DEFAULT_REPO} into ${targetPath}...`);
        await cloneRepo(DEFAULT_REPO, targetPath);
      }

      // Step 2: Resolve port availability
      let requestedPort = parseInt(options.port, 10) || 3000;
      if (Number.isNaN(requestedPort) || requestedPort <= 0) requestedPort = 3000;
      console.log(`Checking availability for port ${requestedPort}...`);
      const freePort = await portfinder.getPortPromise({ port: requestedPort });

      if (freePort !== requestedPort) {
        console.log(`Port ${requestedPort} is already in use. Using port ${freePort} instead.`);
      } else {
        console.log(`Port ${requestedPort} is available.`);
      }

      // Step 3: Install dependencies (unless skipped)
      if (!options.skipInstall) {
        console.log('Installing dependencies with yarn...');
        runCommand('yarn install', { cwd: targetPath });
      } else {
        console.log('Skipping dependency installation (--skip-install).');
      }

      // Step 4: Start always in development mode
      const envForRun = { PORT: String(freePort), NODE_ENV: 'development' };
      console.log(`Starting in development mode on port ${freePort}...`);

      // Read package.json to decide how to start
      const pkgJsonPath = path.join(targetPath, 'package.json');
      let pkg = null;
      try {
        pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      } catch {
        // ignore; fallbacks used below
      }

      const hasDevScript = pkg && pkg.scripts && typeof pkg.scripts.dev === 'string';
      const hasStartScript = pkg && pkg.scripts && typeof pkg.scripts.start === 'string';

      if (hasDevScript) {
        // Preferred: yarn dev --port <port>
        runCommand(`yarn dev --port ${freePort}`, { cwd: targetPath, envOverride: envForRun });
      } else {
        // Fallback: npx vite or yarn start if start happens to run dev server
        try {
          runCommand(`npx vite --port ${freePort}`, { cwd: targetPath, envOverride: envForRun });
        } catch (err) {
          if (hasStartScript) {
            console.log('npx vite failed and package.json has "start". Falling back to `yarn start`.');
            runCommand('yarn start', { cwd: targetPath, envOverride: envForRun });
          } else {
            throw new Error('Could not start dev server: no "dev" script and vite invocation failed. Inspect project scripts.');
          }
        }
      }
    } catch (error) {
      console.error('Error:', error.message || error);
      process.exit(1);
    }
  });

program.parse(process.argv);
