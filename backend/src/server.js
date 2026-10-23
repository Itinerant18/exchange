import { createApp } from './app.js';
import { closeDatabasePool } from './config/database.js';
import { env } from './config/env.js';
import { platform } from './config/platform.js';

const app = createApp();
const server = app.listen(env.port, env.host, () => {
  const displayHost = env.host === '0.0.0.0' ? '127.0.0.1' : env.host;
  console.log(`[server] ${platform.name} API listening on http://${displayHost}:${env.port}`);
  console.log(`[server] Health: http://${displayHost}:${env.port}${env.apiPrefix}/health`);
  console.log(`[server] Environment: ${env.nodeEnv}`);
});

server.on('error', async (error) => {
  console.error('[server] Failed to start:', error.message);
  await closeDatabasePool().catch(() => {});
  process.exitCode = 1;
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[server] ${signal} received; shutting down`);

  const forceExitTimer = setTimeout(() => {
    console.error('[server] Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async (error) => {
    if (error) {
      console.error('[server] HTTP server close failed:', error.message);
    }

    try {
      await closeDatabasePool();
    } catch (poolError) {
      console.error('[server] Database pool close failed:', poolError.message);
      process.exitCode = 1;
    }

    clearTimeout(forceExitTimer);
    process.exit(process.exitCode ?? (error ? 1 : 0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
