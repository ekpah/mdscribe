'use server';
import { authClient } from '@/lib/auth-client';
import { anthropic } from '@ai-sdk/anthropic';
import { env } from '@repo/env';
import { type CoreMessage, generateText } from 'ai';
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();

export async function POST(req: Request) {
  //get session and active subscription from better-auth

  const { data: subscriptions } = await authClient.subscription.list();

  // get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { prompt }: { prompt: string } = await req.json();
  const { anamnese } = JSON.parse(prompt);
  //const allowAIUseFlag = await allowAIUse();
  // allowAIUseFlag is true for now for everyone to try it out
  const allowAIUseFlag = true;
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
  const chatPrompt = await langfuse.getPrompt('ER_Anamnese', undefined, {
    type: 'chat',
  });
  const compiledChatPrompt = chatPrompt.compile({
    anamnese,
  });

  // Assert that the Langfuse output is compatible with CoreMessage[]
  const messages: CoreMessage[] = compiledChatPrompt as CoreMessage[];
  const { text, usage } = await generateText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    //model: google('gemini-2.5-pro-exp-03-25'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 20000,
    temperature: 1,
    /*experimental_telemetry: {
      isEnabled: true,
      metadata: {
        user: session?.user?.id || 'unknown',
      },
    },*/
    messages: messages,
  });
  if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }
  return Response.json({ text: text.split('</analysis>')[1] });
}
