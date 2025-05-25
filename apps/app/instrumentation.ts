import { env } from '@repo/env';
import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
  registerOTel({
    serviceName: 'MDScribe',
    traceExporter: new LangfuseExporter({
      environment: env.NODE_ENV as string,
    }),
  });
}
