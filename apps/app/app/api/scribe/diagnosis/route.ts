'use server';
import { authClient } from '@/lib/auth-client';
import { google } from '@ai-sdk/google';
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
  const chatPrompt = await langfuse.getPrompt('ER_Diagnose', undefined, {
    type: 'chat',
  });
  const compiledChatPrompt = chatPrompt.compile({
    anamnese,
  });

  // Assert that the Langfuse output is compatible with CoreMessage[]
  const messages: CoreMessage[] = compiledChatPrompt as CoreMessage[];

  const { text, usage } = await generateText({
    model: google('gemini-2.0-flash-lite'),
    maxTokens: 2000,
    temperature: 0,
    messages: messages, // Use the mapped and correctly typed messages
  });

  if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }
  console.log('result', text);
  return Response.json({ text });
}
