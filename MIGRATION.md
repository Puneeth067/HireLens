# HireLens Migration Guide

> Step-by-step guide to migrate your current HireLens project to the new unified structure

## 🎯 Migration Overview

This migration transforms your project from:

- Separate `client/` and `server/` directories
- Duplicated types and configurations
- Manual development workflow

To:

- Unified monorepo structure with `apps/` and `packages/`
- Shared types and configuration
- Automated development and build scripts

## 📋 Pre-Migration Checklist

- [ ] Backup your current project
- [ ] Commit all pending changes
- [ ] Ensure Node.js 18+ and Python 3.8+ are installed
- [ ] Stop all running development servers

## 🚀 Step-by-Step Migration

### Step 1: Create New Directory Structure

```bash
# Create the new folder structure
mkdir -p apps packages/{shared-types,config} scripts docs
```

### Step 2: Move Existing Applications

```bash
# Move client and server to apps directory
mv client apps/
mv server apps/
```

### Step 3: Copy New Configuration Files

Copy these files to your project root (they should already be created):

- `package.json` (root workspace configuration)
- `.env.example` (environment template)
- `docker-compose.yml` (Docker setup)
- `README.md` (updated documentation)
- `MIGRATION.md` (this file)

### Step 4: Create Shared Packages

The following files should already be created:

- `packages/shared-types/package.json`
- `packages/shared-types/tsconfig.json`
- `packages/shared-types/src/index.ts`
- `packages/config/package.json`
- `packages/config/tsconfig.json`
- `packages/config/src/index.ts`

### Step 5: Create Development Scripts

Make scripts executable:

```bash
chmod +x scripts/dev.sh
chmod +x scripts/build.sh
```

### Step 6: Update Client Dependencies

Update `apps/client/package.json` to include shared packages:

```json
{
  "dependencies": {
    "@hirelens/shared-types": "workspace:*",
    "@hirelens/config": "workspace:*",
    // ... existing dependencies
  }
}
```

### Step 7: Install Dependencies

```bash
# Install all dependencies including workspaces
npm install
```

### Step 8: Update Import Paths in Client

Update imports in `apps/client/lib/api.ts`:

```typescript
// Before
import { Job, ParsedResume, ... } from './types';

// After  
import { Job, ParsedResume, ... } from '@hirelens/shared-types';
```

Update imports throughout the client application:

```bash
# Find all TypeScript files that import from './types' or '../types'
find apps/client -name "*.ts" -o -name "*.tsx" | xargs grep -l "from ['\"]\./types['\"]\|from ['\"]\.\.*/types['\"]" | while read file; do
  # Replace relative type imports with shared package imports
  sed -i 's/from ["\']\.\.\?\/\?lib\/types["\'];/from "@hirelens\/shared-types";/g' "$file"
  sed -i 's/from ["\']\.\.\?\/\?types["\'];/from "@hirelens\/shared-types";/g' "$file"
done
```

### Step 9: Update Server Configuration

Update `apps/server/app/config.py` to use shared config:

```python
# Add at the top of config.py
from typing import Dict, Any
import json
import os

# Load shared configuration if available
def load_shared_config() -> Dict[str, Any]:
    config_path = os.path.join(os.path.dirname(__file__), '../../../../packages/config/src/index.ts')
    # For now, use environment variables
    # Future: Parse TypeScript config or use JSON schema
    return {}
```

### Step 10: Create Environment File

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your specific configuration
```

### Step 11: Build Shared Packages

```bash
# Build shared packages
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/config
```

### Step 12: Test the Migration

```bash
# Start development environment
./scripts/dev.sh
```

Verify that:

- [ ] Frontend loads at http://localhost:3000
- [ ] Backend API responds at http://localhost:8000
- [ ] API documentation loads at http://localhost:8000/docs
- [ ] No TypeScript errors in client
- [ ] No import errors in shared packages

### Step 13: Clean Up Old Files (Optional)

After verifying everything works:

```bash
# Remove the original types file (now in shared package)
rm apps/client/lib/types.ts

# Remove any duplicate configuration files
# Review and remove as needed
```

## 🔧 Post-Migration Configuration

### Update VSCode Workspace (if using)

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.suggest.autoImports": true,
  "eslint.workingDirectories": [
    "apps/client",
    "packages/shared-types",
    "packages/config"
  ]
}
```

### Configure IDE for Monorepo

For better development experience:

- Install workspace extensions for your IDE
- Configure TypeScript to recognize workspace packages
- Set up debugger configurations for both client and server

## 🐛 Troubleshooting

### Common Issues

**1. "Cannot resolve '@hirelens/shared-types'"**

```bash
# Rebuild shared packages
npm run build --workspace=packages/shared-types
# Restart TypeScript server in your IDE
```

**2. "Module not found" errors**

```bash
# Clear all node_modules and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install
```

**3. "Permission denied" on scripts**

```bash
chmod +x scripts/*.sh
```

**4. Python import errors in server**

```bash
# Ensure Python dependencies are installed
cd apps/server
pip install -r requirements.txt
```

### Rollback Plan

If migration fails:

1. **Restore from backup**
2. **Move apps back to root**:
   ```bash
   mv apps/client ./client
   mv apps/server ./server
   ```
3. **Remove new files**:
   ```bash
   rm -rf packages scripts apps
   rm package.json .env.example docker-compose.yml
   ```

## ✅ Verification Checklist

- [ ] All TypeScript compiles without errors
- [ ] Client can import from `@hirelens/shared-types`
- [ ] Development script starts both servers
- [ ] Build script creates production builds
- [ ] API endpoints match client expectations
- [ ] File uploads work correctly
- [ ] Database/file storage paths are correct
- [ ] Environment variables are properly loaded

## 🎉 Benefits After Migration

1. **Single Source of Truth**: Shared types prevent client/server mismatches
2. **Unified Development**: One command starts entire development environment
3. **Better Maintainability**: Clear separation of concerns and dependencies
4. **Production Ready**: Proper build scripts and Docker configuration
5. **Scalable**: Easy to add new apps or shared packages

## 📞 Getting Help

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Review error messages carefully
4. Create an issue with detailed error information

---

**The migration should preserve all existing functionality while providing a much better development experience!**
