'use server';
import { anthropic } from '@ai-sdk/anthropic';
import { type CoreMessage, generateText } from 'ai';
import { Langfuse } from 'langfuse';

import { allowAIUse } from '@/flags';
import { authClient } from '@/lib/auth-client';
import { env } from '@repo/env';

const langfuse = new Langfuse();

export async function POST(req: Request) {
  //get session and active subscription from better-auth

  const { data: subscriptions } = await authClient.subscription.list();

  // get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { prompt }: { prompt: string } = await req.json();
  const { anamnese, diagnosen } = JSON.parse(prompt);
  const allowAIUseFlag = await allowAIUse();
  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Stichpunkte ein.', { status: 400 });
  }

  if (!allowAIUseFlag && !activeSubscription) {
    return new Response(
      'Unauthorized: Du brauchst ein aktives Abo um diese Funktion zu nutzen.',
      { status: 401 }
    );
  }

  // Get current `production` version of a chat prompt
  const chatPrompt = await langfuse.getPrompt('ER_Discharge', undefined, {
    type: 'chat',
  });
  const compiledChatPrompt = chatPrompt.compile({
    anamnese,
    diagnosen,
  });

  // Assert that the Langfuse output is compatible with CoreMessage[]
  const messages: CoreMessage[] = compiledChatPrompt as CoreMessage[];

  const { text, usage } = await generateText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    maxTokens: 20000,
    temperature: 1,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 8000 },
      },
    },
    messages,
  });

  if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }

  return Response.json({ text });
}
