import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5433/tennisscope?schema=public'),
  RAPIDAPI_KEY: z.string().optional(),
  RAPIDAPI_HOST: z.string().default('tennis-api-atp-wta-itf.p.rapidapi.com'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  SYNC_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  DAILY_API_REQUEST_BUDGET: z.coerce.number().default(45),
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
