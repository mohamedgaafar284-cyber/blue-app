import { spawn, execSync } from 'child_process';

export default async function globalSetup() {
  const execName = 'bunx';

  console.info('\n[Global Setup] Initializing test database schema...');
  try {
    execSync(`${execName} prisma db push --accept-data-loss`, {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
      },
      stdio: 'inherit',
    });
    console.info('[Global Setup] Database schema initialized.');
  } catch (err) {
    console.error('[Global Setup] Database schema initialization failed:', err);
    throw err;
  }

  console.info('[Global Setup] Seeding test database...');
  try {
    execSync(`${execName} tsx prisma/seed.ts`, {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
        DEMO_MODE: 'true',
      },
      stdio: 'inherit',
    });
    console.info('[Global Setup] Seeding completed.');
  } catch (err) {
    console.error('[Global Setup] Seeding failed:', err);
    throw err;
  }

  console.info('[Global Setup] Starting Next.js test server on port 3001...');
  
  // Spawn Next.js dev server on port 3001
  const serverProcess = spawn(execName, ['next', 'dev', '-p', '3001'], {
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: 'file:./test.db',
      DEMO_MODE: 'true',
      PORT: '3001',
    },
    detached: false,
    shell: true,
    stdio: 'ignore',
  });

  // Save reference to process globally so we can terminate it in teardown
  ((globalThis as unknown) as Record<string, unknown>).__NEXT_SERVER__ = serverProcess;

  // Poll /api/health until online
  const start = Date.now();
  let healthy = false;
  
  console.info('[Global Setup] Waiting for server to become healthy...');
  while (Date.now() - start < 45000) { // 45s timeout for compilation
    try {
      const res = await fetch('http://localhost:3001/api/health');
      if (res.ok) {
        healthy = true;
        break;
      }
    } catch {
      // Server not ready yet — wait
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (healthy) {
    console.info('[Global Setup] Next.js test server is healthy on port 3001.');
    process.env.TEST_URL = 'http://localhost:3001';
    process.env.DEMO_MODE = 'true';
  } else {
    console.error('[Global Setup] Next.js test server failed to start or become healthy within 45 seconds.');
    serverProcess.kill();
    throw new Error('Test server failed to start');
  }
}
