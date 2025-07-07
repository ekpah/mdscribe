import { database } from '@repo/database';
import { embed } from 'ai';
import { headers } from 'next/headers';
import pgvector from 'pgvector';
import { voyage } from 'voyage-ai-provider';
import { auth } from '@/auth';
import {
  createInputValidator,
  createScribeHandler,
} from '../../_lib/scribe-handler';

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

const handleProcedures = createScribeHandler({
  promptName: 'Procedure_chat',
  validateInput: createInputValidator(['prompt']),
  processInput: async (input: unknown) => {
    const { prompt } = input as { prompt: string };
    const { procedureNotes } = JSON.parse(prompt);

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

    // Use the relevant template, if there is one and otherwise use the default template
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

    return {
      notes: procedureNotes,
      relevantTemplate,
    };
  },
  modelConfig: {
    thinking: true,
    thinkingBudget: 8000,
    maxTokens: 20_000,
    temperature: 1,
  },
});

export const POST = handleProcedures;
