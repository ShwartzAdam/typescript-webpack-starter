'use strict';

const validateProjectName = require('validate-npm-package-name');
const chalk = require('chalk');
const semver = require('semver');
const spawn = require('cross-spawn');
const commander = require('commander');
const fs = require('fs-extra');
const path = require('path');

const packageJson = require('./package.json');

let projectName;

const program = new commander.Command(packageJson.name)
  .version(packageJson.version)
  .arguments('<project-directory>')
  .usage(`${chalk.green('<project-directory>')}`)
  .action(name => {
    projectName = name;
  })
  .on('--help', () => {
    console.log(`    Only ${chalk.green('<project-directory>')} is required.`);
    console.log();
  })
  .parse(process.argv);

if (typeof projectName === 'undefined') {
  console.error('Please specify the project directory:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`);
  console.log();
  console.log('For example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-typescript-lib')}`);
  console.log();
  console.log(`Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`);
  process.exit(1);
}

createApp(projectName);

function createApp(name) {
  const root = path.resolve(name);
  const appName = path.basename(root);

  checkAppName(appName);
  fs.ensureDirSync(name);
  if (!isSafeToCreateProjectIn(root, name)) {
    process.exit(1);
  }

  console.log(`Creating a new TypeScript library in ${chalk.green(root)}.`);
  console.log();

  const originalDirectory = process.cwd();
  process.chdir(root);

  if (!semver.satisfies(process.version, '>=6.0.0')) {
    console.log(
      chalk.yellow(
        `You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
          `Please update to Node 6 or higher for a better, fully supported experience.\n`
      )
    );
  }

  const npmInfo = checkNpmVersion();
  if (!npmInfo.hasMinNpm) {
    if (npmInfo.npmVersion) {
      console.log(
        chalk.yellow(
          `You are using npm ${npmInfo.npmVersion} so the project will be boostrapped with an old unsupported version of tools.\n\n` +
            `Please update to npm 3 or higher for a better, fully supported experience.\n`
        )
      );
    }
  }
  run(root, appName, originalDirectory);
}

function run(root, appName, originalDirectory) {
  const templatePath = path.resolve(__dirname, 'template');
  if (fs.existsSync(templatePath)) {
    fs.copySync(templatePath, root);
    let packageJsonPath = path.join(root, 'package.json');
    let packageJson = require(packageJsonPath);
    packageJson.name = appName;
    packageJson.version = '0.0.1';

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Installing packages. This might take a couple of minutes.');
    return install();
  } else {
    console.error(`Could not locate supplied template: ${chalk.green(templatePath)}`);
    return;
  }
}

function install() {
  return new Promise((resolve, reject) => {
    let command;
    let args;

    command = 'npm';
    args = ['install', '--save', '--save-exact', '--loglevel', 'error'];

    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `${command} ${args.join(' ')}`
        });
        return;
      }
      resolve();
    });
  });
}

function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(`Could not create a project called ${chalk.red(`"${appName}"`)} because of npm naming restrictions:`);
    printValidationResults(validationResult.errors);
    printValidationResults(validationResult.warnings);
    process.exit(1);
  }
}

function printValidationResults(results) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk.red(`  *  ${error}`));
    });
  }
}

function isSafeToCreateProjectIn(root, name) {
  const validFiles = [
    '.DS_Store',
    'Thumbs.db',
    '.git',
    '.gitignore',
    '.idea',
    'README.md',
    'LICENSE',
    'web.iml',
    '.hg',
    '.hgignore',
    '.hgcheck'
  ];
  console.log();

  const conflicts = fs.readdirSync(root).filter(file => !validFiles.includes(file));
  if (conflicts.length < 1) {
    return true;
  }

  console.log(`The directory ${chalk.green(name)} contains files that could conflict:`);
  console.log();
  for (const file of conflicts) {
    console.log(`  ${file}`);
  }
  console.log();
  console.log('Either try using a new directory name, or remove the files listed above.');

  return false;
}

function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;
  try {
    npmVersion = execSync('npm --version')
      .toString()
      .trim();
    hasMinNpm = semver.gte(npmVersion, '3.0.0');
  } catch (err) {
    // ignore
  }
  return {
    hasMinNpm: hasMinNpm,
    npmVersion: npmVersion
  };
}
