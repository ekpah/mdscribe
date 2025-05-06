'use server';

import { allowAIUse } from '@/flags';
import { authClient } from '@/lib/auth-client';
import { google } from '@ai-sdk/google';
import { env } from '@repo/env';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
export async function POST(req: Request) {
  //get session and active subscription from better-auth

  const { data: subscriptions } = await authClient.subscription.list();

  // get the active subscription
  const activeSubscription = subscriptions?.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
  );

  const { prompt }: { prompt: string } = await req.json();

  const { anamnese } = JSON.parse(prompt);
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

  const {text,usage} = await generateText({
    model: google('gemini-2.0-flash-lite'),
    maxTokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content:
          'Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus den folgenden unsortierten Notizen eine möglichst korrekte Verdachtsdiagnose zu erstellen.',
      },
      {
        role: 'user',
        content: `
Basierend auf Ihrer Analyse, stellen Sie nun die wahrscheinlichste Verdachtsdiagnose auf und geben Sie folgende Informationen zurück:

**[ICD-10 Code]**: [diagnose als text]

Wichtige Hinweise:
- Verwenden Sie nur Informationen aus den bereitgestellten Notizen
- Stellen Sie die wahrscheinlichste Verdachtsdiagnose auf
- Die Verdachtsdiagnose sollte spezifisch und nicht allgemein sein

Bevor Sie Ihre endgültige Antwort geben, überprüfen Sie bitte:
- Die Korrektheit der Diagnose nach ICD-10
- Die Verwendung korrekter medizinischer Terminologie

Ihre Antwort sollte nur die wahrscheinlichste Verdachtsdiagnose im oben gezeigten Markdown-Format enthalten, ohne zusätzliche Kommentare oder Erklärungen. Wiederholen Sie nicht die Schritte oder Überlegungen aus Ihrem Denkprozess in der endgültigen Antwort.

Bitte beachten Sie, dass die Vordiagnosen aus einem vergangenen Aufenthalt stammen und nicht direkt für die aktuelle Vorstellung anwendbar sind.

Hier sind die unsortierten Stichpunkte zur Anamnese:

<stichpunkte>
${anamnese}
</stichpunkte>

Erstelle nach obenstehenden Formatierungskriterien einen Diagnoseblock für die Aufnahmeanamnese in der Notaufnahme mit der wahrscheinlichsten Verdachtsdiagnose.`,
      },
    ],
  });

  if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }
  console.log('result', text);
  return Response.json({ text });
}
