import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().transform((val) => val.split(',').map((s) => s.trim())),
  ROOM_TTL_MINUTES: z.coerce.number().default(120),
  ROOM_CLEANUP_INTERVAL_MS: z.coerce.number().default(60000),
  MAX_FILE_SIZE_MB: z.coerce.number().default(100),
  UPLOAD_URL_EXPIRY_SECONDS: z.coerce.number().default(300),
  DOWNLOAD_URL_EXPIRY_SECONDS: z.coerce.number().default(300),
  DATABASE_URL: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  S3_BUCKET_NAME: z.string().default('dropx-files-dev'),
  STORAGE_PROVIDER: z.enum(['s3', 'local']).default('s3'),
  PENDING_FILE_TTL_MINUTES: z.coerce.number().default(30),
  MAX_FILES_PER_ROOM: z.coerce.number().default(20),
  MAX_ROOM_STORAGE_BYTES: z.coerce.number().default(524288000),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  SOCKET_TOKEN_SECRET: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().default(10),
  TRUST_PROXY_HOPS: z.coerce.number().default(1),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
