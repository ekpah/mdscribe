'use server';
import { auth } from '@/auth';
import { authClient } from '@/lib/auth-client';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { env } from '@repo/env';
import { type CoreMessage, streamText } from 'ai';
import { Langfuse } from 'langfuse';
import { headers } from 'next/headers';

const langfuse = new Langfuse();

export async function POST(req: Request) {
  //get session and active subscription from better-auth

  const { data: subscriptions } = await authClient.subscription.list();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { prompt }: { prompt: string } = await req.json();
  const { dischargeNotes } = JSON.parse(prompt);
  //const allowAIUseFlag = await allowAIUse();
  // allowAIUseFlag is true for now for everyone to try it out
  const allowAIUseFlag = !!session?.user;
  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Entlassungsnotizen ein.', {
      status: 400,
    });
  }

  if (!allowAIUseFlag && !activeSubscription) {
    return new Response(
      'Unauthorized: Du brauchst ein aktives Abo um diese Funktion zu nutzen.',
      { status: 401 }
    );
  }
  // Get current `production` version of a chat prompt
  const chatPrompt = await langfuse.getPrompt(
    'Inpatient_discharge_chat',
    undefined,
    {
      type: 'chat',

      label: env.NODE_ENV === 'production' ? 'production' : 'staging',
    }
  );
  const compiledChatPrompt = chatPrompt.compile({
    notes: dischargeNotes,
  });

  // Assert that the Langfuse output is compatible with CoreMessage[]
  const messages: CoreMessage[] = compiledChatPrompt as CoreMessage[];

  const result = await streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    //model: google('gemini-2.5-pro-exp-03-25'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 20000,
    temperature: 1,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
        langfusePrompt: chatPrompt.toJSON(),
      },
    },
    providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 8000 },
    } satisfies AnthropicProviderOptions,
  },
    messages: messages,
    onFinish: (result) => {
      console.log('Prompt tokens:', result.usage.promptTokens);
      console.log('Completion tokens:', result.usage.completionTokens);
      console.log('Total tokens:', result.usage.totalTokens);
    },
  });
  return result.toDataStreamResponse();
}
