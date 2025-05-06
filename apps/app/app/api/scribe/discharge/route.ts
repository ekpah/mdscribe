'use server';
import { anthropic } from '@ai-sdk/anthropic';

import { allowAIUse } from '@/flags';
import { authClient } from '@/lib/auth-client';
import { env } from '@repo/env';
import { streamText } from 'ai';

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

  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 20000,
    temperature: 1,
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 8000 },
      },
    },
    /*experimental_telemetry: {
      isEnabled: true,
      metadata: {
        user: session?.user?.id || 'unknown',
      },
    },*/
    messages: [
      {
        role: 'system',
        content:
          'Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus einer vorliegenden Anamnese und Diagnoseliste einen Entlassbericht zu erstellen. Sie sind in der Wortwahl präzise, aber auch knapp und effizient.',
      },
      {
        role: 'user',
        content: `Verwenden Sie die folgenden Markdoc-Tags für fehlende oder variable Informationen:

1. Info-Tag: Verwenden Sie das folgende Format für kurze Informationen wie Namen, Laborwerte oder einzelne Zahlen:
   \`\`\`
   {% info "Bezeichnung" /%}
   \`\`\`
   Beispiel: {% info "Patienten-Name" /%} oder {% info "Blutdruck" /%}

2. Switch-Tag: Verwenden Sie das folgende Format für Textabschnitte, die je nach Option variieren sollen:
   \`\`\`
   {% switch "Bezeichnung" %}
     {% case "Option1" %}Text für Option1{% /case %}
     {% case "Option2" %}Text für Option2{% /case %}
   {% /switch %}
   \`\`\`
   Beispiel für Geschlechtsanpassung:
   \`\`\`
   {% switch "Geschlecht" %}
     {% case "m" %}Der Patient{% /case %}
     {% case "w" %}Die Patientin{% /case %}
   {% /switch %}
   \`\`\`

Erstellen Sie für den Entlassbericht einen Fließtext. Dieser sollte die Zusammenfassung enthalten, wie für einen Arztbrief üblich. Hierin sollte kurz der Vorstellungsgrund erwähnt werden, relevante Befunde gewertet und das Vorgehen eingeordnet werden. Ebenso sollten Empfehlungen zum weiteren Procedere gegeben werden. Die Zusammenfassung sollte kurz und prägnant geschrieben sein. Insgesamt enthält sie zwei Abschnitte (mit ## zu kennzeichnen):
- Zusammenfassung (Fließtext)
- Procedere (In Stichpunkten gehalten, die wie eine ToDo-Liste die wichtigsten Punkte für den Hausarzt auflisten)

Der finale Entlassbericht wird auch die Anamnese und die Diagnose enthalten. Verweise also lediglich auf diese Informationen, wenn unbedingt nötig, wiederhole sie aber nicht.

Überprüfen Sie vor der Fertigstellung Ihren Entlassbericht:

<validierung>
Prüfen Sie auf:
- Vollständigkeit aller wichtigen Informationen
- Logisch kohärente Abfolge
- Korrekte medizinische Terminologie
- Korrekte Syntax der Markdoc-Tags (besonders auf korrekte Leerzeichen und Schrägstriche achten)
- Unklare oder unbekannte Informationen durch Markdoc-Tags ersetzt
- Übereinstimmung der Informationen aus Anamnese und Diagnoseliste
</validierung>

Hier ist die Anamnese:

<anamnese>
${anamnese}
</anamnese>

Ihre aktuelle Verdachtsdiagnose ist wie folgt:

<diagnose>
${diagnosen}
</diagnose>


Formatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Entlassbericht aus, ohne zusätzliche Kommentare oder Erklärungen.`,
      },
    ],

    onFinish: ({ usage }) => {
      const { promptTokens, completionTokens, totalTokens } = usage;
      // your own logic, e.g. for saving the chat history or recording usage
      if (env.NODE_ENV === 'development') {
        console.log('Prompt tokens:', promptTokens);
        console.log('Completion tokens:', completionTokens);
        console.log('Total tokens:', totalTokens);
      }
    },
  });

  return result.toDataStreamResponse();
}
