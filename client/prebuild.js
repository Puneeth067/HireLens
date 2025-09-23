import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

console.log('Prebuilding shared packages...');

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
  process.exit(1);
}