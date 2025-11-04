import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const server: Parameters<typeof createEnv>[0]['server'] = {
  POSTGRES_DATABASE_URL: z.string().min(1).url(),

  ANALYZE: z.string().optional(),

  AUTH_POSTMARK_KEY: z.string().min(1),

  BETTER_AUTH_SECRET: z.string().min(1),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PLUS_PRICE_ID: z.string().min(1),
  STRIPE_PLUS_PRICE_ID_ANNUAL: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().min(1),

  // Langfuse configuration
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_BASEURL: z.string().min(1).url(),

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
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1),
};

export const env = createEnv({
  client,
  server,
  runtimeEnv: {
    POSTGRES_DATABASE_URL: process.env.POSTGRES_DATABASE_URL,

    AUTH_POSTMARK_KEY: process.env.AUTH_POSTMARK_KEY,

    ANALYZE: process.env.ANALYZE,
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PLUS_PRICE_ID: process.env.STRIPE_PLUS_PRICE_ID,
    STRIPE_PLUS_PRICE_ID_ANNUAL: process.env.STRIPE_PLUS_PRICE_ID_ANNUAL,
    VERCEL: process.env.VERCEL,
    NEXT_RUNTIME: process.env.NEXT_RUNTIME,
    FLAGS_SECRET: process.env.FLAGS_SECRET,
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASEURL: process.env.LANGFUSE_BASEURL,
  },
});
