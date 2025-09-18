# HireLens Project Refactoring Plan

## Current Issues Identified

### 1. Type/Model Duplication
- `client/lib/types.ts` and `server/app/models/*.py` have overlapping definitions
- No single source of truth for shared data structures
- Maintenance burden when updating interfaces

### 2. Configuration Inconsistencies
- `server/app/config.py` has redundant settings (`UPLOAD_DIR` vs `upload_dir`)
- Directory creation scattered between `config.py` and `main.py`
- No centralized environment management

### 3. API Integration Issues
- Client API calls hardcoded in `client/lib/api.ts`
- No validation that frontend types match backend models
- Inconsistent error handling patterns

### 4. Project Structure Problems
- No shared utilities or types between client/server
- Build and deployment scripts scattered
- No unified development workflow

## Proposed Solution

### Step 1: Create Unified Root Structure
```
hirelens/
├── apps/
│   ├── client/          # Next.js frontend
│   └── server/          # FastAPI backend  
├── packages/
│   ├── shared-types/    # Shared TypeScript/Python types
│   ├── config/          # Shared configuration
│   └── utils/           # Shared utilities
├── scripts/             # Build and deployment scripts
├── docs/               # Documentation
└── .env.example        # Environment template
```

### Step 2: Implement Shared Types Package
- Create `packages/shared-types/` with TypeScript definitions
- Generate Python models from TypeScript using codegen
- Single source of truth for all data structures

### Step 3: Centralize Configuration
- Move all config to `packages/config/`
- Create environment-specific configs (dev, staging, prod)
- Implement config validation

### Step 4: Standardize API Integration
- Create OpenAPI spec from FastAPI models
- Generate TypeScript client from OpenAPI spec
- Implement consistent error handling

### Step 5: Improve Development Workflow
- Root-level package.json with workspaces
- Unified scripts for dev, build, test, deploy
- Docker composition for local development

### Step 6: File Migrations

#### Move existing files:
- `client/` → `apps/client/`
- `server/` → `apps/server/`
- Extract shared types from `client/lib/types.ts` → `packages/shared-types/`
- Move config logic from `server/app/config.py` → `packages/config/`

#### Create new files:
- `packages/shared-types/models.ts` (master type definitions)
- `packages/config/environment.ts` (unified config)
- `scripts/dev.sh` (development startup)
- `scripts/build.sh` (production build)
- `docker-compose.yml` (local development)

### Step 7: API Integration Fixes
- Update `apps/client/lib/api.ts` to use generated client
- Implement consistent error boundaries in React components
- Add request/response validation middleware

### Step 8: Production Readiness
- Add health checks and monitoring
- Implement proper logging and error tracking
- Create deployment configurations
- Add automated testing pipeline

## Migration Commands

```bash
# 1. Create new structure
mkdir -p apps packages/{shared-types,config,utils} scripts docs

# 2. Move existing directories
mv client apps/
mv server apps/

# 3. Initialize package management
npm init -w apps/client -w apps/server

# 4. Create shared packages
cd packages/shared-types && npm init
cd ../config && npm init
cd ../utils && npm init

# 5. Update import paths
# (Manual process - update all imports in moved files)

# 6. Install dependencies
npm install
```

## Expected Benefits

1. **Consistency**: Single source of truth for types and config
2. **Maintainability**: Clear module boundaries and dependencies
3. **Developer Experience**: Unified development workflow
4. **Production Ready**: Proper deployment and monitoring setup
5. **Scalability**: Easy to add new apps or packages

This refactoring maintains all existing functionality while creating a robust, production-ready monorepo structure.