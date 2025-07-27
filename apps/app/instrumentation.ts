import { env } from '@repo/env';
import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export async function register() {
  await import('./lib/orpc.server');
  registerOTel({
    serviceName: 'MDScribe',
    traceExporter: new LangfuseExporter({
      environment: env.NODE_ENV as string,
    }),
  });
}
