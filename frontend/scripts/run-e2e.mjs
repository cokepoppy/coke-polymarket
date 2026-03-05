import net from 'node:net';
import { spawn } from 'node:child_process';

const host = '127.0.0.1';
const port = 4173;
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

async function run() {
  const devServer = spawn(
    npmCmd,
    ['run', 'dev', '--', '--port', String(port), '--host', host, '--strictPort'],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );

  let exited = false;
  devServer.on('exit', () => {
    exited = true;
  });

  try {
    await waitForPort({ host, port, timeoutMs });

    if (exited) {
      throw new Error('Dev server exited before becoming ready');
    }

    const playwrightArgs = process.argv.slice(2);
    const testProc = spawn(npxCmd, ['playwright', 'test', ...playwrightArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_TEST_BASE_URL: `http://${host}:${port}`,
      },
    });

    const code = await new Promise((resolve) => {
      testProc.on('exit', (exitCode) => resolve(exitCode ?? 1));
    });

    devServer.kill('SIGTERM');
    process.exit(code);
  } catch (error) {
    devServer.kill('SIGTERM');
    console.error('[e2e] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

run();
