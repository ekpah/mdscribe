'use server';
import { embed } from 'ai';
import { voyage } from 'voyage-ai-provider';

export const generateEmbeddings = async (
  content: string
): Promise<{ embedding: number[]; content: string }> => {
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-large'),
    value: content,
  });
  return { embedding, content };
};
