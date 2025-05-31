'use server';
import { auth } from '@/auth';
import { embed } from 'ai';
import { headers } from 'next/headers';
import { voyage } from 'voyage-ai-provider';

export const generateEmbeddings = async (
  content: string,
  title: string,
  category: string
): Promise<{ embedding: number[] }> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const contentWithMetadata = `---
title: ${title}
category: ${category}
---

${content}`;
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-large', {
      inputType: 'document',
    }),
    value: contentWithMetadata,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
        value: contentWithMetadata,
      },
    },
  });
  return { embedding };
};
