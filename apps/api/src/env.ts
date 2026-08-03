/** Validated process env. Fails fast at boot rather than at first request. */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  host: optional('HOST', '0.0.0.0'),
  port: Number(optional('PORT', '4000')),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? null,
  /** Shared secret the inbound-email webhook must present (Phase 1). */
  ingestEmailSecret: process.env.INGEST_EMAIL_SECRET ?? null,
  webOrigin: optional('WEB_ORIGIN', 'http://localhost:3000'),

  // Web Push (spec §10). Absent keys leave the worker idle rather than
  // crashing the API — push is not required for reading.
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? null,
  vapidSubject: optional('VAPID_SUBJECT', 'mailto:info@betterman.com'),
};

export const isProduction = env.nodeEnv === 'production';
