#!/usr/bin/env node
/**
 * BluePrint Setup Script (Node.js) — Bulletproof Windows version
 *
 * Every error is caught and displayed. The process NEVER exits without
 * showing the error and waiting for the user to press Enter.
 */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ============================================
// Helpers
// ============================================

function log(msg) { console.log(msg); }
function logOK(msg) { console.log(`[OK] ${msg}`); }
function logError(msg) { console.error(`[ERROR] ${msg}`); }
function logStep(step, msg) { console.log(`\n=== Step ${step}: ${msg} ===\n`); }

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

function generateSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Run a command and capture ALL output (stdout + stderr).
 * Returns { success, stdout, stderr, exitCode }.
 * Does NOT use shell:true (avoids Windows cmd.exe issues).
 */
function runCmd(cmd, args, timeoutMs) {
  console.log(`  > ${cmd} ${args.join(' ')}`);
  try {
    const result = spawnSync(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'], // Capture output, inherit stdin
      cwd: process.cwd(),
      timeout: timeoutMs || 300000,
      encoding: 'utf-8',
      windowsHide: false,
    });

    // Print captured output
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error) {
      return { success: false, error: result.error.message, exitCode: -1 };
    }
    if (result.signal) {
      return { success: false, error: `Timed out or killed (${result.signal})`, exitCode: -1 };
    }
    return { success: result.status === 0, exitCode: result.status };
  } catch (err) {
    return { success: false, error: err.message, exitCode: -1 };
  }
}

/**
 * Wait for user to press Enter, then exit.
 * This is the ONLY way the script exits — ensures the window stays open.
 */
function waitAndExit(code) {
  console.log('\n========================================');
  console.log(code === 0 ? 'Setup completed.' : 'Setup FAILED. See errors above.');
  console.log('Press Enter to exit...');
  console.log('========================================');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(code));
}

// ============================================
// Main
// ============================================

async function main() {
  log('==================================================');
  log('  BluePrint - Engineering Consultancy ERP');
  log('==================================================\n');

  // ── Prerequisites ──────────────────────────
  log('[Checking prerequisites...]');

  let runner = 'node';
  let pkgMgr = 'npm';
  let execCmd = 'npx';

  // Check for bun
  const bunCheck = spawnSync('where', ['bun'], { stdio: 'pipe', shell: true, encoding: 'utf-8' });
  if (bunCheck.status === 0) {
    runner = 'bun';
    pkgMgr = 'bun';
    execCmd = 'bunx';
    logOK('Bun found');
  } else {
    const nodeCheck = spawnSync('where', ['node'], { stdio: 'pipe', shell: true, encoding: 'utf-8' });
    if (nodeCheck.status !== 0) {
      logError('Neither Bun nor Node.js found! Please install Node.js from https://nodejs.org/');
      return waitAndExit(1);
    }
    logOK('Node.js found');
  }

  const gitCheck = spawnSync('where', ['git'], { stdio: 'pipe', shell: true, encoding: 'utf-8' });
  if (gitCheck.status !== 0) {
    logError('Git not found. Please install Git.');
    return waitAndExit(1);
  }
  logOK('Git found');
  logOK('Ready to setup\n');

  // ── Step 1: Choose Mode ────────────────────
  log('=== Step 1: Choose Mode ===\n');
  log('  [1] Demo Mode (sample data + auto login)');
  log('  [2] Production Mode (clean, needs SMTP)\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let modeChoice = await question(rl, 'Enter choice (1 or 2, default=1): ');
  if (!modeChoice || (modeChoice !== '1' && modeChoice !== '2')) modeChoice = '1';
  const isDemo = modeChoice === '1';

  // ── Step 2: Choose Database ─────────────────
  log('\n=== Step 2: Choose Database ===\n');
  log('  [1] PostgreSQL (for production)');
  log('  [2] SQLite (for quick demo)\n');

  let dbChoice = await question(rl, 'Enter choice (1 or 2, default=2): ');
  if (!dbChoice || (dbChoice !== '1' && dbChoice !== '2')) dbChoice = '2';
  const isPostgres = dbChoice === '1';
  const databaseUrl = isPostgres
    ? 'postgresql://blueprint:blueprint_dev@localhost:5432/blueprint?schema=public'
    : 'file:./db/custom.db';

  // ── Step 3: Generate Secrets ────────────────
  logStep(3, 'Generating Secrets');
  const jwtSecret = generateSecret(48);
  const encryptionKey = generateSecret(48);
  const csrfSecret = generateSecret(48);
  logOK('Secrets generated');

  // ── Step 4: Create .env ─────────────────────
  logStep(4, 'Creating .env file');
  if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', '.env.backup');
    logOK('Old .env backed up');
  }
  const envContent = [
    `DATABASE_URL=${databaseUrl}`,
    `JWT_SECRET="${jwtSecret}"`,
    `NEXTAUTH_SECRET="${jwtSecret}"`,
    `CSRF_SECRET="${csrfSecret}"`,
    `ENCRYPTION_KEY="${encryptionKey}"`,
    `DEMO_MODE=${isDemo ? 'true' : 'false'}`,
    `COOKIE_SECURE=false`,
    `NODE_ENV=${isDemo ? 'development' : 'production'}`,
    `NEXTAUTH_URL="http://localhost:3000"`,
    `SMTP_HOST=""`, `SMTP_PORT="587"`, `SMTP_USER=""`, `SMTP_PASS=""`,
    `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""`, `STRIPE_SECRET_KEY=""`, `STRIPE_WEBHOOK_SECRET=""`,
  ].join('\n') + '\n';
  fs.writeFileSync('.env', envContent, 'utf8');
  logOK('.env configured');

  // ── Step 5: Prepare Prisma schema ───────────
  logStep(5, 'Preparing Prisma schema');
  // Run prepare-schema.js using require() instead of spawnSync — simpler, no subprocess
  try {
    require('./prepare-schema.js');
    logOK('Prisma schema prepared');
  } catch (err) {
    logError(`Failed to prepare Prisma schema: ${err.message}`);
    rl.close();
    return waitAndExit(1);
  }

  // ── Step 6: Clean old files ─────────────────
  logStep(6, 'Cleaning old files');
  try {
    if (fs.existsSync('.next')) fs.rmSync('.next', { recursive: true, force: true });
    if (!isPostgres && fs.existsSync('db/custom.db')) fs.unlinkSync('db/custom.db');
    logOK('Cleaned');
  } catch (err) {
    logError(`Failed to clean: ${err.message}`);
    // Continue anyway — not fatal
  }

  // ── Step 7: Install dependencies ────────────
  logStep(7, `Installing dependencies (${pkgMgr} install)`);
  log('  (This may take 3-10 minutes on first run. Please wait...)');
  const installResult = runCmd(pkgMgr, ['install'], 600000);
  if (!installResult.success) {
    logError(`Failed to install dependencies!`);
    logError(`Error: ${installResult.error || `Exit code: ${installResult.exitCode}`}`);
    logError('Try running "' + pkgMgr + ' install" manually in the terminal.');
    rl.close();
    return waitAndExit(1);
  }
  logOK('Dependencies installed');

  // ── Step 8: Create database tables ──────────
  logStep(8, 'Creating Database Tables (prisma db push)');

  // Try node_modules/.bin/prisma first, then npx --yes
  const prismaBin = path.join('node_modules', '.bin', 'prisma');
  let dbResult;

  if (fs.existsSync(prismaBin)) {
    log('  Using local prisma binary...');
    dbResult = runCmd(prismaBin, ['db', 'push'], 120000);
  } else {
    log('  Prisma not found locally, using npx...');
    dbResult = runCmd(execCmd, ['--yes', 'prisma', 'db', 'push'], 120000);
  }

  if (!dbResult.success) {
    logError('Failed to push database schema!');
    logError(`Error: ${dbResult.error || `Exit code: ${dbResult.exitCode}`}`);
    logError('');
    logError('Possible causes:');
    logError('  1. Prisma is not installed (check node_modules/.bin/prisma)');
    logError('  2. DATABASE_URL is incorrect in .env file');
    logError('  3. For PostgreSQL: make sure Postgres is running');
    logError('  4. For SQLite: make sure db/ directory exists');
    logError('');
    logError('Try running manually:');
    logError('  npx prisma db push');
    rl.close();
    return waitAndExit(1);
  }
  logOK('Database schema pushed');

  // ── Step 9: Seed data ───────────────────────
  logStep(9, 'Seeding data');
  if (isDemo) {
    log('  Running prisma seed... (may take 1-2 minutes)');
    const tsxBin = path.join('node_modules', '.bin', 'tsx');
    let seedResult;

    if (fs.existsSync(tsxBin)) {
      seedResult = runCmd(tsxBin, ['prisma/seed.ts'], 300000);
    } else {
      seedResult = runCmd(execCmd, ['--yes', 'tsx', 'prisma/seed.ts'], 300000);
    }

    if (!seedResult.success) {
      logError('Failed to seed demo data!');
      logError(`Error: ${seedResult.error || `Exit code: ${seedResult.exitCode}`}`);
      logError('You can try seeding manually: npx tsx prisma/seed.ts');
      rl.close();
      return waitAndExit(1);
    }
    logOK('Demo data seeded');
  } else {
    logOK('Skipped (Production Mode)');
  }

  // ── Step 10: Generate Prisma Client ─────────
  logStep(10, 'Generating Prisma Client');
  let genResult;
  if (fs.existsSync(prismaBin)) {
    genResult = runCmd(prismaBin, ['generate'], 120000);
  } else {
    genResult = runCmd(execCmd, ['--yes', 'prisma', 'generate'], 120000);
  }
  if (!genResult.success) {
    logError('Failed to generate Prisma Client!');
    logError(`Error: ${genResult.error || `Exit code: ${genResult.exitCode}`}`);
    rl.close();
    return waitAndExit(1);
  }
  logOK('Prisma Client ready');

  // ── Step 11: Generate setup token (demo only) ──
  let setupToken = '';
  if (isDemo) {
    logStep(11, 'Generating setup token');
    try {
      const token = crypto.randomBytes(24).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      fs.writeFileSync('.setup-tokens.json', JSON.stringify({
        version: 1,
        tokens: [{ hash, createdAt: Date.now(), consumed: false }],
        updatedAt: new Date().toISOString(),
      }, null, 2), 'utf8');
      setupToken = token;
      logOK('Token generated');
    } catch (err) {
      logError(`Token generation failed: ${err.message} (not fatal)`);
    }
  }

  // ── Summary ─────────────────────────────────
  log('\n==================================================');
  log('           [OK] Setup Complete!');
  log('==================================================');
  log(`  Mode:     ${isDemo ? 'DEMO' : 'PRODUCTION'}`);
  log('  URL:      http://localhost:3000');
  log(`  Database: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

  if (isDemo && setupToken) {
    log('\n[SECURE] Demo login credentials:');
    log('  1. Open: http://localhost:3000/setup-complete');
    log('  2. Enter token:');
    log(`     ${setupToken}`);
    log('\n  Save this token now — it will not be shown again.');
  } else if (isDemo) {
    log('\n[INFO] Demo credentials: admin@blueprint.ae');
  }

  // ── Ask to start server ─────────────────────
  let startDev = await question(rl, '\nStart server now? (y/n, default=y): ');
  if (!startDev) startDev = 'y';
  rl.close();

  if (startDev.toLowerCase() === 'y') {
    log('\nChecking port 3000...');
    try {
      if (process.platform === 'win32') {
        const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf-8' });
        if (netstat.stdout) {
          const lines = netstat.stdout.split('\n');
          for (const line of lines) {
            if (line.includes(':3000') && line.includes('LISTENING')) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && pid !== '0' && pid !== process.pid.toString()) {
                log(`[INFO] Port 3000 is occupied by process PID ${pid}. Freeing port 3000...`);
                spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
              }
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    log('\nStarting development server...');
    log('  (Press Ctrl+C to stop)\n');
    // Use spawn (not spawnSync) so the server runs in foreground
    const { spawn } = require('child_process');
    const dev = spawn(pkgMgr, ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });
    dev.on('close', (code) => {
      console.log(`\nServer stopped (exit code: ${code})`);
      waitAndExit(code || 0);
    });
    dev.on('error', (err) => {
      logError(`Failed to start server: ${err.message}`);
      waitAndExit(1);
    });
  } else {
    return waitAndExit(0);
  }
}

// Global error handlers — catch EVERYTHING
process.on('uncaughtException', (err) => {
  console.error('\n[FATAL] Uncaught exception:', err.message);
  console.error('Stack:', err.stack);
  console.error('\nPress Enter to exit...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('\n[FATAL] Unhandled rejection:', reason);
  console.error('\nPress Enter to exit...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});

main().catch((err) => {
  console.error('\n[FATAL] Setup failed:', err.message);
  console.error('Stack:', err.stack);
  console.error('\nPress Enter to exit...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});
