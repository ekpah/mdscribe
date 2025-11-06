'use server';
import { env } from '@repo/env';
import { embed } from 'ai';
import { headers } from 'next/headers';
import { voyage } from 'voyage-ai-provider';
import { VoyageAIClient } from 'voyageai';
import { auth } from '@/auth';

const client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY as string });
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
  const embedding = await client
    .embed({
      input: contentWithMetadata,
      model: 'voyage-3-large',
    })
    .then((res) => res.data?.[0].embedding ?? []);

  return { embedding };
};
