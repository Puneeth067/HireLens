const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building workspace packages...');

// Helper function to execute command with error handling
function execCommand(command, cwd) {
  try {
    console.log(`Executing: ${command} in ${cwd}`);
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

try {
  // Build shared-types package
  console.log('Building @hirelens/shared-types...');
  const sharedTypesPath = path.join(__dirname, 'packages', 'shared-types');
  execCommand('npm run build', sharedTypesPath);
  
  // Build config package
  console.log('Building @hirelens/config...');
  const configPath = path.join(__dirname, 'packages', 'config');
  execCommand('npm run build', configPath);
  
  // Build client
  console.log('Building client...');
  const clientPath = path.join(__dirname, 'client');
  execCommand('npm run build', clientPath);
  
  console.log('All workspace packages built successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}