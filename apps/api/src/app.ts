import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env, isProduction } from './env.js';
import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProduction
      ? { level: 'info' }
      : { level: 'debug', transport: { target: 'pino-pretty' } },
    trustProxy: true,
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: isProduction ? [env.webOrigin] : true,
    credentials: true,
  });

  await app.register(healthRoutes);
  await app.register(ingestRoutes);

  return app;
}
