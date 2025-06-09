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
  // Get session and active subscription from better-auth
  const { data: subscriptions } = await authClient.subscription.list();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { prompt }: { prompt: string } = await req.json();
  const { patientNotes } = JSON.parse(prompt);

  // Allow AI use flag - true for authenticated users for now
  const allowAIUseFlag = !!session?.user;

  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Patientennotizen ein.', {
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
  const chatPrompt = await langfuse.getPrompt('ICU_transfer_chat', undefined, {
    type: 'chat',
    label: env.NODE_ENV === 'production' ? 'production' : 'staging',
  });
  const compiledChatPrompt = chatPrompt.compile({
    notes: patientNotes,
  });

  // Assert that the Langfuse output is compatible with CoreMessage[]
  const messages: CoreMessage[] = compiledChatPrompt as CoreMessage[];

  const result = await streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    maxTokens: 2000,
    temperature: 0.1,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
        langfusePrompt: chatPrompt.toJSON(),
      },
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
