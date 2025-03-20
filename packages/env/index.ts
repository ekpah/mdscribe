import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const server: Parameters<typeof createEnv>[0]['server'] = {
  POSTGRES_PRISMA_URL: z.string().min(1).url(),
  POSTGRES_DATABASE_URL: z.string().min(1).url(),
  POSTGRES_DATABASE_URL_UNPOOLED: z.string().min(1).url(),
  POSTGRES_PGHOST: z.string().min(1),
  POSTGRES_PGPASSWORD: z.string().min(1),
  POSTGRES_PGDATABASE: z.string().min(1),
  POSTGRES_PGHOST_UNPOOLED: z.string().min(1),
  POSTGRES_PGUSER: z.string().min(1),
  ANALYZE: z.string().optional(),
  AUTH_TRUST_HOST: z.string().min(1),
  AUTH_POSTMARK_KEY: z.string().min(1),
  POSTGRES_DATABASE: z.string().min(1),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_URL: z.string().min(1).url(),
  POSTGRES_URL_NON_POOLING: z.string().min(1).url(),
  POSTGRES_URL_NO_SSL: z.string().min(1).url(),
  POSTGRES_USER: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PLUS_PRICE_ID: z.string().min(1),
  STRIPE_PLUS_PRICE_ID_ANNUAL: z.string().min(1),

  // Added by Node
  NODE_ENV: z.enum(['development', 'production']),
  CI: z.string().optional(),

  // Added by Vercel
  VERCEL: z.string().optional(),
  NEXT_RUNTIME: z.enum(['nodejs', 'edge']).optional(),
  FLAGS_SECRET: z.string().min(1),
};

const client: Parameters<typeof createEnv>[0]['client'] = {
  NEXT_PUBLIC_BASE_URL: z.string().min(1).url(),
};

export const env = createEnv({
  client,
  server,
  runtimeEnv: {
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,
    POSTGRES_DATABASE_URL_UNPOOLED: process.env.POSTGRES_DATABASE_URL_UNPOOLED,
    POSTGRES_PGHOST: process.env.POSTGRES_PGHOST,
    POSTGRES_PGPASSWORD: process.env.POSTGRES_PGPASSWORD,
    POSTGRES_PGDATABASE: process.env.POSTGRES_PGDATABASE,
    POSTGRES_PGHOST_UNPOOLED: process.env.POSTGRES_PGHOST_UNPOOLED,
    POSTGRES_PGUSER: process.env.POSTGRES_PGUSER,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    AUTH_POSTMARK_KEY: process.env.AUTH_POSTMARK_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    POSTGRES_URL_NO_SSL: process.env.POSTGRES_URL_NO_SSL,
    POSTGRES_USER: process.env.POSTGRES_USER,
    ANALYZE: process.env.ANALYZE,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PLUS_PRICE_ID: process.env.STRIPE_PLUS_PRICE_ID,
    STRIPE_PLUS_PRICE_ID_ANNUAL: process.env.STRIPE_PLUS_PRICE_ID_ANNUAL,
    VERCEL: process.env.VERCEL,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    FLAGS_SECRET: process.env.FLAGS_SECRET,
  },
});
