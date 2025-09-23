#!/usr/bin/env node

// Vercel build script that ensures proper build order for workspace packages
import { execSync } from 'child_process';
import { join } from 'path';

console.log('Running Vercel build script...');

try {
  // Change to the root directory
  const rootDir = join(process.cwd(), '..');
  console.log('Root directory:', rootDir);

  // Build shared packages in order
  console.log('Building shared packages...');
  
  // Build shared-types package
  console.log('Building @hirelens/shared-types...');
  execSync('npm run build --workspace=@hirelens/shared-types', { 
    stdio: 'inherit',
    cwd: rootDir
  });

  // Build config package
  console.log('Building @hirelens/config...');
  execSync('npm run build --workspace=@hirelens/config', { 
    stdio: 'inherit',
    cwd: rootDir
  });

  // Now build the client
  console.log('Building client...');
  execSync('npx next build', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('Vercel build completed successfully!');
} catch (error) {
  console.error('Vercel build failed:', error.message);
  process.exit(1);
}