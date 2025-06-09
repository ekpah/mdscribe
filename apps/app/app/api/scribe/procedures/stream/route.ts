'use server';
import { auth } from '@/auth';
import { authClient } from '@/lib/auth-client';
import { anthropic } from '@ai-sdk/anthropic';
import { database } from '@repo/database';
import { env } from '@repo/env';
import { type CoreMessage, embed, streamText } from 'ai';
import { Langfuse } from 'langfuse';
import { headers } from 'next/headers';
import pgvector from 'pgvector';
import { voyage } from 'voyage-ai-provider';

// Type definition for template search results
interface TemplateSearchResult {
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  updatedAt: Date;
  similarity: number;
}

const langfuse = new Langfuse();

const generateEmbeddings = async (
  content: string
): Promise<{ embedding: number[]; content: string }> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-large'),
    value: content,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: session?.user?.id || 'unknown',
      },
    },
  });
  return { embedding, content };
};

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

  // Generate embeddings for the user query
  const { embedding } = await generateEmbeddings(procedureNotes);
  const embeddingSql = pgvector.toSql(embedding);

  // Use raw SQL for vector similarity search to get top results
  const similarityResults = await database.$queryRaw<TemplateSearchResult[]>`
      SELECT 
        id,
        title,
        category,
        content,
        "authorId",
        "updatedAt",
        (1 - (embedding <=> ${embeddingSql}::vector)) as similarity
      FROM "Template"
      WHERE embedding IS NOT NULL
      AND (1 - (embedding <=> ${embeddingSql}::vector)) > 0.6
      ORDER BY embedding <-> ${embeddingSql}::vector
      LIMIT 5
    `;

  // use the relevant template, if there is one and otherwise use the default template
  const relevantTemplate = similarityResults[0]?.content
    ? `## Relevante Textbaustein-Vorlage (Referenz)

Nutze die folgende Vorlage als Beispiel eines Textbausteins. Dieser ist anhand der gegebenen Informationen ausgewählt und potenziell relevant, der Assistent baut also darauf auf. Bei Diskrepanzen, nutze auf jeden Fall die Informationen aus der Nutzereingabe!
${similarityResults[0]?.content}`
    : `## Standard-Textbausteine (Referenz)

<details>
<summary>ZVK-Anlage Vorlage</summary>

### Befund
Sonographische Darstellung der V. jugularis {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %} und Markierung der Punktionsstelle, Desinfektion, steriles Abdecken, Lokalanästhesie mit {% info "Mecain-Volumen" /%} ml 1% Mecainlösung. Primär komplikationslose Anlage eines {% info "Lumen-Anzahl" /%}-lumigen zentralen Venenkatheters unter sonographischer Sicht. Aspiration von Blut aus allen Schenkeln problemlos möglich. Spülung, A-Naht.

### Beurteilung
Primär komplikationslose ZVK-Anlage {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %} jugulär.

### Empfehlung
Röntgen-Lagekontrolle erforderlich, anschließend Freigabe zur ZVK-Nutzung.

</details>

<details>
<summary>Kardioversion Vorlage</summary>

### Befund
Vorstellung zur elektrischen Kardioversion bei symptomatischem Vorhofflimmern. Vorheriges TEE ohne Thrombusnachweis, sichere Antikoagulation. Nach Aufklärung und erneutem Einverständnis erfolgte Sedierung mit {% info "Propofol-Dosis" /%} mg Propofol (1%). Elektrische Kardioversion mit {% info "Joule-Energie" /%} Joule (antero-laterale Elektrodenposition, 1. Schockabgabe).

### Beurteilung
Erfolgreiche Kardioversion in stabilen Sinusrhythmus.

### Empfehlung
EKG-Kontrolle, Monitoring, Antikoagulation fortführen.

</details>

<details>
<summary>Thoraxdrainage Vorlage</summary>

### Befund
Nach Desinfektion, sterilem Abdecken und Lokalanästhesie mit {% info "Mecain-Volumen" /%} ml 1% Mecainlösung primär komplikationslose Anlage einer {% info "Drainagegröße" /%} Chr Thoraxdrainage in Bülau-Position {% switch "Seite" %}{% case "rechts" %}rechts{% /case %}{% case "links" %}links{% /case %}{% /switch %}. Einzelknopfnaht der Hautwunde, U-Naht mit Drainage-Fixierung.

### Beurteilung
Komplikationslose Thoraxdrainage-Anlage.

### Empfehlung
Röntgen-Kontrolle, Drainage-Monitoring, Fördermengen-Dokumentation.

</details>`;

  // Get current `;production` version of a chat prompt
  const chatPrompt = await langfuse.getPrompt('Procedure_chat', undefined, {
    type: 'chat',
    label: env.NODE_ENV === 'production' ? 'production' : 'staging',
  });
  const compiledChatPrompt = chatPrompt.compile({
    notes: procedureNotes,
    relevantTemplate: relevantTemplate,
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
    messages: messages,
    onFinish: (result) => {
      console.log('Prompt tokens:', result.usage.promptTokens);
      console.log('Completion tokens:', result.usage.completionTokens);
      console.log('Total tokens:', result.usage.totalTokens);
    },
  });
  return result.toDataStreamResponse();
}
