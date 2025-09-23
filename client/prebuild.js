import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

console.log('Prebuilding shared packages...');

// Skip prebuild in Vercel environment since packages are built separately
if (process.env.VERCEL) {
  console.log('Skipping prebuild in Vercel environment');
  process.exit(0);
}

try {
  // Build shared-types package
  console.log('Building @hirelens/shared-types...');
  const sharedTypesPath = join(process.cwd(), '..', 'packages', 'shared-types');
  
  if (existsSync(sharedTypesPath)) {
    execSync('npm run build', { cwd: sharedTypesPath, stdio: 'inherit' });
  } else {
    console.log('Shared types package not found, skipping...');
  }
  
  // Build config package
  console.log('Building @hirelens/config...');
  const configPath = join(process.cwd(), '..', 'packages', 'config');
  
  if (existsSync(configPath)) {
    execSync('npm run build', { cwd: configPath, stdio: 'inherit' });
  } else {
    console.log('Config package not found, skipping...');
  }
  
  console.log('Shared packages built successfully!');
} catch (error) {
  console.error('Prebuild failed:', error.message);
  console.error('This might be expected in some environments like Vercel where dependencies are pre-installed');
  // Don't exit with error code 1 in Vercel environment
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}