#!/usr/bin/env node

/**
 * Setup Verification Script
 * 
 * This script checks if your RealLeads.ai backend is properly configured.
 * Run it before starting the server to catch configuration issues early.
 * 
 * Usage:
 *   node check-setup.js
 *   # or
 *   npm run check-setup
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 RealLeads.ai Setup Verification\n');
console.log('=' .repeat(50));

let allGood = true;

// ============================================================================
// Check 1: Required Files Exist
// ============================================================================

console.log('\n📁 Checking required files...');

const requiredFiles = [
  'backend/src/server.ts',
  'backend/src/db/client.ts',
  'backend/src/db/queries.ts',
  'backend/src/orchestrator/index.ts',
  'backend/src/orchestrator/parser.ts',
  'backend/src/orchestrator/prompts.ts',
  'backend/src/executor/index.ts',
  'backend/src/executor/validators.ts',
  'backend/src/integrations/openai.ts',
  'backend/src/middleware/logger.ts',
  'backend/src/middleware/error-handler.ts',
  'backend/src/middleware/env-validator.ts',
  'backend/src/routes/health.ts',
  'backend/src/routes/auth.ts',
  'backend/src/routes/command.ts',
  'backend/src/routes/leads.ts',
  'backend/package.json',
  'backend/tsconfig.json',
];

requiredFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allGood = false;
  }
});

// ============================================================================
// Check 2: Environment Variables
// ============================================================================

console.log('\n🔐 Checking environment variables...');

// In Replit, env vars are in process.env even without dotenv
const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_JWT_SECRET',
  'OPENAI_API_KEY',
];

const optionalEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'PORT',
  'CORS_ORIGIN',
  'ORCHESTRATOR_MODEL',
];

requiredEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName} is set`);
  } else {
    console.log(`  ❌ ${varName} - NOT SET (required)`);
    allGood = false;
  }
});

console.log('\n  Optional environment variables:');
optionalEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName} is set`);
  } else {
    console.log(`  ⚠️  ${varName} - not set (optional)`);
  }
});

// ============================================================================
// Check 3: Dependencies Installed
// ============================================================================

console.log('\n📦 Checking dependencies...');

const packageJsonPath = 'backend/package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const nodeModulesPath = 'backend/node_modules';

  if (fs.existsSync(nodeModulesPath)) {
    console.log('  ✅ node_modules exists');

    // Check key dependencies
    const keyDeps = ['express', 'openai', 'pg', '@supabase/supabase-js', 'zod'];
    keyDeps.forEach((dep) => {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        console.log(`  ✅ ${dep} installed`);
      } else {
        console.log(`  ❌ ${dep} - NOT INSTALLED`);
        allGood = false;
      }
    });
  } else {
    console.log('  ❌ node_modules not found - run: cd backend && npm install');
    allGood = false;
  }
} else {
  console.log('  ❌ package.json not found');
  allGood = false;
}

// ============================================================================
// Check 4: TypeScript Configuration
// ============================================================================

console.log('\n⚙️  Checking TypeScript configuration...');

const tsconfigPath = 'backend/tsconfig.json';
if (fs.existsSync(tsconfigPath)) {
  console.log('  ✅ tsconfig.json exists');

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

  if (tsconfig.compilerOptions?.strict) {
    console.log('  ✅ Strict mode enabled');
  } else {
    console.log('  ⚠️  Strict mode not enabled (recommended)');
  }

  if (tsconfig.compilerOptions?.outDir) {
    console.log(`  ✅ Output directory: ${tsconfig.compilerOptions.outDir}`);
  }
} else {
  console.log('  ❌ tsconfig.json not found');
  allGood = false;
}

// ============================================================================
// Check 5: Database Migrations
// ============================================================================

console.log('\n🗄️  Checking database migrations...');

const migrationsDir = 'backend/migrations';
if (fs.existsSync(migrationsDir)) {
  const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

  if (migrations.length > 0) {
    console.log(`  ✅ Found ${migrations.length} migration(s):`);
    migrations.forEach((m) => console.log(`     - ${m}`));
    console.log('\n  ⚠️  Make sure to run these in Supabase SQL Editor!');
  } else {
    console.log('  ⚠️  No migration files found');
  }
} else {
  console.log('  ❌ migrations/ directory not found');
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('\n✅ All checks passed! Your setup looks good.');
  console.log('\nNext steps:');
  console.log('  1. Run migrations in Supabase SQL Editor');
  console.log('  2. Start the backend: cd backend && npm run dev');
  console.log('  3. Test the health endpoint: curl http://localhost:3001/health');
  console.log('  4. Test authentication from your frontend\n');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Please fix the issues above.');
  console.log('\nCommon fixes:');
  console.log('  - Missing files: Copy files from the integration package');
  console.log('  - Missing env vars: Set in Replit Secrets tab');
  console.log('  - Missing dependencies: Run "cd backend && npm install"\n');
  process.exit(1);
}
