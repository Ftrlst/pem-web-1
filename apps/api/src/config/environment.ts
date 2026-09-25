import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PAYMENT_PROVIDER: z.string().default('manual'),
  MIDTRANS_SERVER_KEY: z.string().optional().default(''),
  MIDTRANS_CLIENT_KEY: z.string().optional().default(''),
  MIDTRANS_WEBHOOK_SECRET: z.string().optional().default(''),
  XENDIT_SECRET_KEY: z.string().optional().default(''),
  XENDIT_WEBHOOK_SECRET: z.string().optional().default(''),
  SENTRY_DSN: z.string().optional().default(''),
  LOG_LEVEL: z.string().default('info'),
});

export function validateEnvironment(config: Record<string, unknown>) {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Konfigurasi environment tidak valid: ${details}`);
  }
  return result.data;
}
