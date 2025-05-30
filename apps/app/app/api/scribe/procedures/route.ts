'use server';
import { auth } from '@/auth';
import { authClient } from '@/lib/auth-client';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
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
  const { procedureNotes } = JSON.parse(prompt);
  //const allowAIUseFlag = await allowAIUse();
  // allowAIUseFlag is true for now for everyone to try it out
  const allowAIUseFlag = !!session?.user;
  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Prozedur-Notizen ein.', {
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
  const textPrompt = await langfuse.getPrompt('Procedure');
  const compiledPrompt = textPrompt.compile({
    procedureNotes,
  });

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
        langfusePrompt: textPrompt.toJSON(),
      },
    },
    prompt: compiledPrompt,
    onFinish: (result) => {
      console.log('Prompt tokens:', result.usage.promptTokens);
      console.log('Completion tokens:', result.usage.completionTokens);
      console.log('Total tokens:', result.usage.totalTokens);
    },
  });
  return result.toDataStreamResponse();
}
