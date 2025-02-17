#!/usr/bin/env node

const { Command } = require('commander');
const simpleGit = require('simple-git');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const portfinder = require('portfinder');

const program = new Command();

// Helper to ensure Yarn is installed
function ensureYarn() {
  try {
    execSync('yarn --version', { stdio: 'ignore' });
    console.log('Yarn is already installed.');
  } catch {
    console.log('Yarn is not installed. Installing Yarn...');
    execSync('npm install -g yarn', { stdio: 'inherit' });
  }
}

program
  .argument('<folderName>', 'Name of the folder to create')
  .option('-p, --port <number>', 'Preconfigured port number', '3000') // Default port
  .action(async (folderName, options) => {
    const repoUrl = 'https://github.com/alphabit-technology/loopar-framework.git';
    try {
      // Step 1: Ensure Yarn is installed
      ensureYarn();

      // Step 2: Create the target folder
      const targetPath = path.resolve(process.cwd(), folderName);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath);
        console.log(`Folder created: ${folderName}`);
      } else {
        console.error(`The folder ${folderName} already exists.`);
        process.exit(1);
      }

      // Step 3: Clone the GitHub repository into the folder
      console.log(`Cloning ${repoUrl} into ${folderName}...`);
      await simpleGit().clone(repoUrl, targetPath);

      // Step 4: Check if the specified port is available
      let port = parseInt(options.port, 10);
      console.log(`Checking availability for port ${port}...`);
      port = await portfinder.getPortPromise({ port });

      if (port !== parseInt(options.port, 10)) {
        console.log(`Port ${options.port} is already in use. Using port ${port} instead.`);
      } else {
        console.log(`Port ${options.port} is available.`);
      }

      // Step 5: Update the configuration file with the selected port (if applicable)
      process.env.PORT = port;

      // Step 6: Install project dependencies
      console.log('Installing dependencies...');
      execSync('yarn install', { cwd: targetPath, stdio: 'inherit' });

      // Step 7: Run the development server
      console.log(`Starting the development server on port ${port}...`);
      execSync(`yarn dev --port ${port}`, { cwd: targetPath, stdio: 'inherit' });
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
