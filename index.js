#!/usr/bin/env node

const { Command } = require('commander');
const simpleGit = require('simple-git');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const portfinder = require('portfinder');

const program = new Command();

program
  .argument('<folderName>', 'Name of the folder to create')
  .option('-p, --port <number>', 'Preconfigured port number', '3000') // Default port
  .action(async (folderName, repoUrl, options) => {
    const repoUrl = 'https://github.com/alphabit-technology/loopar-framework.git';
    try {
      // Step 1: Create the target folder
      const targetPath = path.resolve(process.cwd(), folderName);
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath);
        console.log(`Folder created: ${folderName}`);
      } else {
        console.error(`The folder ${folderName} already exists.`);
        process.exit(1);
      }

      // Step 2: Clone the GitHub repository into the folder
      console.log(`Cloning ${repoUrl} into ${folderName}...`);
      await simpleGit().clone(repoUrl, targetPath);

      // Step 3: Check if the specified port is available
      const port = await portfinder.getPortPromise({ port: parseInt(options.port, 10) });
      if (port !== parseInt(options.port, 10)) {
        console.log(`Port ${options.port} is already in use. Using port ${port} instead.`);
      } else {
        console.log(`Port ${options.port} is available.`);
      }

      // Step 4: Update the configuration file with the selected port (if applicable)
      const configPath = path.join(targetPath, 'config.js'); // Adjust this path based on your project
      if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf-8');
        config = config.replace(/port:\s*\d+/i, `port: ${port}`); // Adjust based on your file format
        fs.writeFileSync(configPath, config, 'utf-8');
        console.log(`Configuration updated with port ${port}.`);
      }

      // Step 5: Install project dependencies
      console.log('Installing dependencies...');
      execSync('npm install', { cwd: targetPath, stdio: 'inherit' });

      // Step 6: Run the development server
      console.log('Starting the development server...');
      execSync('npm run dev', { cwd: targetPath, stdio: 'inherit' });
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
