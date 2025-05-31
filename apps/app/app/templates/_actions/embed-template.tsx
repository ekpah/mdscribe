'use server';
import { auth } from '@/auth';
import { embed } from 'ai';
import { headers } from 'next/headers';
import { voyage } from 'voyage-ai-provider';

export const generateEmbeddings = async (
  content: string
): Promise<{ embedding: number[]; content: string }> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-large'),
    value: content,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
      },
    },
  });
  return { embedding, content };
};
