import net from 'node:net';
import { spawn } from 'node:child_process';

const frontendHost = '127.0.0.1';
const frontendPort = 4173;
const backendHost = '127.0.0.1';
const backendPort = 8091;
const timeoutMs = 60_000;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function waitForPort({ host, port, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tryConnect = () => {
      const socket = net.createConnection({ host, port });

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryConnect, 250);
      });
    };

    tryConnect();
  });
}

function kill(proc) {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
}

async function run() {
  const backendBaseUrl = `http://${backendHost}:${backendPort}`;
  const frontendBaseUrl = `http://${frontendHost}:${frontendPort}`;

  const backendServer = spawn(npmCmd, ['run', 'dev'], {
    cwd: new URL('../../server/', import.meta.url),
    stdio: 'inherit',
    env: {
      ...process.env,
      MYSQL_ENABLED: 'false',
      PORT: String(backendPort),
      FRONTEND_ORIGIN: frontendBaseUrl,
    },
  });

  const frontendServer = spawn(
    npmCmd,
    ['run', 'dev', '--', '--port', String(frontendPort), '--host', frontendHost, '--strictPort'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_BASE_URL: `${backendBaseUrl}/api/v1`,
        VITE_WS_URL: `ws://${backendHost}:${backendPort}/ws`,
      },
    },
  );

  try {
    await waitForPort({ host: backendHost, port: backendPort, timeoutMs });
    await waitForPort({ host: frontendHost, port: frontendPort, timeoutMs });

    const playwrightArgs = process.argv.slice(2);
    const testProc = spawn(npxCmd, ['playwright', 'test', ...playwrightArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_BASE_URL: frontendBaseUrl,
        PLAYWRIGHT_API_BASE_URL: `${backendBaseUrl}/api/v1`,
      },
    });

    const code = await new Promise((resolve) => {
      testProc.on('exit', (exitCode) => resolve(exitCode ?? 1));
    });

    kill(frontendServer);
    kill(backendServer);
    process.exit(code);
  } catch (error) {
    kill(frontendServer);
    kill(backendServer);
    console.error('[e2e] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

run();
