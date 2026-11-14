import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/tennisscope?schema=public'),
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().default('tennis-api-atp-wta-itf.p.rapidapi.com'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_ORIGINS: z.string().optional(),
  SYNC_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  DAILY_API_REQUEST_BUDGET: z.coerce.number().default(45),
  CRON_SECRET: z.string().optional(),
  ENABLE_LOCAL_SCHEDULER: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === '') return true;
      return val === 'true' || val === '1';
    }),
  ENABLE_PRODUCTION_CRON: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === '') return false;
      return val === 'true' || val === '1';
    }),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();

/**
 * Returns the consolidated list of allowed CORS origins from FRONTEND_ORIGIN and FRONTEND_ORIGINS.
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  if (env.FRONTEND_ORIGIN) {
    origins.add(env.FRONTEND_ORIGIN.trim().replace(/\/+$/, ''));
  }

  if (env.FRONTEND_ORIGINS) {
    env.FRONTEND_ORIGINS.split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  }

  // Always include standard local dev ports if in development
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return Array.from(origins);
}
