import type { FastifyInstance } from 'fastify';
import { prisma } from '@betterman/db';

/**
 * `/health` is the Railway healthcheck target and the Phase 0 acceptance gate.
 * It returns 200 as long as the process is up and the database answers.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    let database: 'ok' | 'unreachable' = 'ok';

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      database = 'unreachable';
      app.log.error({ err }, 'health: database unreachable');
    }

    const body = {
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
    };

    return reply.code(database === 'ok' ? 200 : 503).send(body);
  });

  /** Liveness only — no dependencies touched. */
  app.get('/health/live', async () => ({ status: 'ok' }));
}
