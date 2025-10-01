import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

async function main(): Promise<void> {
  await runCommand('npm', ['run', 'seed']);

  await runCommand('npx', ['tsx', '--test', 'tests/e2e/api.e2e.test.ts'], {
    env: { ...process.env, API_BYPASS_AUTH: process.env.API_BYPASS_AUTH ?? 'true' },
  });

  await runCommand('npm', ['run', 'seed']);

  const preview = spawnCommand('npm', ['run', '-w', 'web-dashboard', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      env: { ...process.env, VITE_BYPASS_AUTH: 'true', BROWSER: 'none' },
    },
  );

  try {
    await waitForServer('http://127.0.0.1:5173/dashboard', 30_000);
    await runCommand('npm', ['run', '-w', 'web-dashboard', 'test:e2e'], {
      env: { ...process.env, DASHBOARD_BASE_URL: 'http://127.0.0.1:5173' },
    });
  } finally {
    await shutdown(preview);
  }
}

main().catch((error) => {
  console.error('[e2e] Failed to complete QA suite', error);
  process.exitCode = 1;
});

type SpawnOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

function spawnCommand(command: string, args: string[], options: SpawnOptions = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  child.on('error', (error) => {
    console.error(`[e2e] failed to start ${command}`, error);
  });

  return child;
}

async function runCommand(command: string, args: string[], options: SpawnOptions = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}`));
      }
    });

    child.on('error', reject);
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // ignore until timeout
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function shutdown(child: ReturnType<typeof spawnCommand> | undefined): Promise<void> {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGINT');
  const exitPromise = once(child, 'exit');
  const timeout = delay(5000).then(() => {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  });

  await Promise.race([exitPromise, timeout]);
}

