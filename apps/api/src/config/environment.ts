import { z } from 'zod';

const environmentSchema = z
  .object({
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
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT access dan refresh secret harus berbeda',
      });
    }
    if (value.NODE_ENV === 'production' && value.COOKIE_SECURE !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE harus true di production',
      });
    }
    if (
      value.NODE_ENV === 'production' &&
      (value.JWT_ACCESS_SECRET.includes('replace') || value.JWT_REFRESH_SECRET.includes('replace'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'Gunakan secret production yang sudah di-generate',
      });
    }
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
