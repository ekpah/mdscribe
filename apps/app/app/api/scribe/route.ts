'use server';
import { anthropic } from '@ai-sdk/anthropic';
import { allowAIUse } from '@repo/feature-flags';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();
  const allowAIUseFlag = await allowAIUse();
  if (prompt.trim().length === 0) {
    return new Response('Bitte geben Sie Stichpunkte ein.', { status: 400 });
  }

  if (!allowAIUseFlag) {
    return new Response(
      'Unauthorized: Only n.hapke@bbtgruppe.de can use this feature',
      { status: 401 }
    );
  }

  const result = streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 4096,
    temperature: 1,
    system:
      'Du bist eine medizinische Schreibkraft in der Notaufnahme. Deine Aufgabe ist es, aus Stichpunkten oder ungeordneten Informationen eine ausformulierte medizinische Anamnese zu erstellen. Du bist sprachlich sehr gut und bringst die wichtigsten Informationen kompakt auf den Punkt. Durch dein ausgeprägtes medizinisches Fachwissen kannst du die gegebenen Informationen logisch strukturieren.',

    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Sie sind ein erfahrener Notfallmediziner/eine erfahrene Notfallmedizinerin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus den folgenden Stichpunkten eine präzise medizinische Anamnese zu erstellen:\n<stichpunkte>\n${prompt}\n</stichpunkte>\nAnalysieren Sie zunächst die Informationen und kategorisieren diese in den folgenden Tags. Erstellen Sie im Anschluss eine fertige Anamnese im <anamnese> tag:\n<analyse>\n1. Hauptbeschwerde identifizieren\n2. Vorstellungskontext bestimmen:\n   - Art: notfallmäßig/elektiv\n   - Begleitung: selbstständig/Angehörige/Rettungsdienst/Notarzt\n</analyse>\n<kategorisierung>\n| Kategorie | Zu erfassende Informationen |\n|-----------|----------------------------|\n| Patientendaten | Alter, Geschlecht |\n| Hauptbeschwerde | Art, Lokalisation, Beginn, Verlauf, Intensität |\n| Begleitsymptome | Aktuelle Beschwerden, relevante Negativbefunde |\n| Vorerkrankungen | Chronische Erkrankungen, Operationen |\n| Medizinische Daten | Allergien, Medikation, Vitalparameter |\n| Soziales | Beruf, Risikofaktoren, Noxen |\n</kategorisierung>\nErstellen Sie nun die Anamnese nach folgenden Regeln:\n\nEinleitung:\n\nBei Notfallpatienten: \"Die notfallmäßige Vorstellung erfolgt [ggf. mit Notarzt/Rettungsdienst] bei [Hauptbeschwerde].\"\nBei elektiven Patienten: \"Die elektive Vorstellung erfolgt bei [Hauptbeschwerde].\"\n\nHauptbeschwerde:\n\nDetaillierte Beschreibung in 2-3 Sätzen\nChronologische Darstellung des Verlaufs\nErwähnung relevanter Trigger oder Modifikatoren\n\nBegleitsymptome und relevante Negativbefunde (als eigener Absatz).\n\nSystematische Erfassung (jeweils als eigener Absatz), formatiert als **[Kategorie]**:\n\nSozialanamnese/Berufsanamnese\nRisikofaktoren/Noxen\nMedikation\nAllergien\n\nVitalparameter:\n\n**Vitalparameter bei Vorstellung:**\nBlutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl\n\nWichtige Hinweise:\n\nVerwenden Sie ausschließlich Informationen aus den Stichpunkten\nMarkieren Sie fehlende kritische Informationen mit \"[nicht dokumentiert]\"\nKeine Interpretation von Befunden oder Diagnosestellung\nKeine Therapieempfehlungen\nKeine Spekulationen über Kausalzusammenhänge\n\n<validierung>\nPrüfen Sie vor Finalisierung:\n- Vollständigkeit der Hauptbeschwerde\n- Sachlich logische Reihenfolge\n- Korrekte medizinische Terminologie\n- Keine Informationen enthalten, die nicht in den Stichpunkten sind\n</validierung>\n\n<diagnose>\nFügen Sie eine Verdachtsdiagnose nach ICD 10 hinzu\n</diagnose>\n\nFormatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnese-Text aus, ohne zusätzliche Kommentare oder Erklärungen.`,
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '<analyse>',
          },
        ],
      },
    ],

    onFinish: ({ usage }) => {
      const { promptTokens, completionTokens, totalTokens } = usage;
      // your own logic, e.g. for saving the chat history or recording usage
      console.log('Prompt tokens:', promptTokens);
      console.log('Completion tokens:', completionTokens);
      console.log('Total tokens:', totalTokens);
    },
  });

  return result.toDataStreamResponse();
}
