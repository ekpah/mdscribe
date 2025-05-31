'use server';
import { auth } from '@/auth';
import { authClient } from '@/lib/auth-client';
import { anthropic } from '@ai-sdk/anthropic';
import { env } from '@repo/env';
import { type CoreMessage, streamText } from 'ai';

import { Langfuse } from 'langfuse';
import { headers } from 'next/headers';

const langfuse = new Langfuse();

export async function POST(req: Request) {
  //get session and active subscription from better-auth

  const { data: subscriptions } = await authClient.subscription.list();

  // get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { prompt }: { prompt: string } = await req.json();

  const { anamnese } = JSON.parse(prompt);
  //const allowAIUseFlag = await allowAIUse();
  // allowAIUseFlag is true for now for everyone to try it out
  const allowAIUseFlag = !!session?.user;
  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Stichpunkte ein.', { status: 400 });
  }

  if (!allowAIUseFlag && !activeSubscription) {
    return new Response(
      'Unauthorized: Du brauchst ein aktives Abo um diese Funktion zu nutzen.',
      { status: 401 }
    );
  }

  const textPrompt = await langfuse.getPrompt('ER_Diagnose_chat', undefined, {
    type: 'chat',
    label: env.NODE_ENV === 'production' ? 'production' : 'staging',
  });
  const compiledPrompt = textPrompt.compile({
    anamnese,
  });
  const messages: CoreMessage[] = compiledPrompt as CoreMessage[];
  const result = await streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    maxTokens: 2000,
    temperature: 0,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
        langfusePrompt: textPrompt.toJSON(),
      },
    },
    messages: messages,
    onFinish: (result) => {
      if (env.NODE_ENV === 'development') {
        console.log('Prompt tokens:', result.usage.promptTokens);
        console.log('Completion tokens:', result.usage.completionTokens);
        console.log('Total tokens:', result.usage.totalTokens);
      }
    },
  });

  return result.toDataStreamResponse();
}
