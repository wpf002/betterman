import { buildApp } from './app.js';
import { env } from './env.js';
import { startPushWorker } from './push/worker.js';
import { startIngestScheduler } from './ingest/scheduler.js';

const app = await buildApp();
const stopPushWorker = startPushWorker(app.log);
const ingestScheduler = startIngestScheduler(app.log);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopPushWorker();
  ingestScheduler.stop();
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: env.host, port: env.port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
