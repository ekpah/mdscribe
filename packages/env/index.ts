import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const server: Parameters<typeof createEnv>[0]['server'] = {
  POSTGRES_PRISMA_URL: z.string().min(1).url(),
  ANALYZE: z.string().optional(),
  AUTH_TRUST_HOST: z.string().min(1),
  AUTH_POSTMARK_KEY: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  POSTGRES_DATABASE: z.string().min(1),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_URL: z.string().min(1).url(),
  POSTGRES_URL_NON_POOLING: z.string().min(1).url(),
  POSTGRES_URL_NO_SSL: z.string().min(1).url(),
  POSTGRES_USER: z.string().min(1),

  // Added by Node
  NODE_ENV: z.enum(['development', 'production']),
  CI: z.string().optional(),

  // Added by Vercel
  VERCEL: z.string().optional(),
  NEXT_RUNTIME: z.enum(['nodejs', 'edge']).optional(),
  FLAGS_SECRET: z.string().min(1),
};

const client: Parameters<typeof createEnv>[0]['client'] = {
  NEXT_PUBLIC_APP_URL: z.string().min(1).url(),
  NEXT_PUBLIC_DOCS_URL: z.string().min(1).url(),

  // Added by Vercel
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).url(),
};

export const env = createEnv({
  client,
  server,
  runtimeEnv: {
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
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

    VERCEL: process.env.VERCEL,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    FLAGS_SECRET: process.env.FLAGS_SECRET,

    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,

    NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL:
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  },
});
