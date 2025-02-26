'use server';
import { anthropic } from '@ai-sdk/anthropic';

import { allowAIUse } from '@repo/feature-flags';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();
  console.log('prompt', prompt);
  const { anamnese, vordiagnosen } = JSON.parse(prompt);
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
    /*experimental_telemetry: {
      isEnabled: true,
      metadata: {
        user: session?.user?.id || 'unknown',
      },
    },*/
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus den folgenden Stichpunkten eine präzise medizinische Anamnese zu erstellen:\n<stichpunkte>\n${anamnese}\n</stichpunkte>\nIhnen liegt außerdem eine Liste mit Vordiagnosen vor, die Sie nutzen, um die aktuelle Anamnese in den Kontext des konkreten Patienten einzuordnen:\n<vordiagnosen>\n${vordiagnosen}\n</vordiagnosen>\nAnalysieren Sie zunächst die Informationen und kategorisieren diese in den folgenden Tags. Erstellen Sie im Anschluss eine fertige Anamnese im <anamnese> tag. Aktualisieren Sie außerdem den Diagnoseblock im <diagnoseblock> tag, wobei die aktuelle Verdachtsdiagnose als Hauptdiagnose aufgeführt wird. Die Vordiagnosen sollten ebenfalls in logischer Reihenfolge enthalten sein:\n<analyse>\n1. Hauptbeschwerde identifizieren\n2. Vorstellungskontext bestimmen:\n   - Art: notfallmäßig/elektiv\n   - Begleitung: selbstständig/Angehörige/Rettungsdienst/Notarzt\n</analyse>\n<kategorisierung>\n| Kategorie | Zu erfassende Informationen |\n|-----------|----------------------------|\n| Patientendaten | Alter, Geschlecht |\n| Hauptbeschwerde | Art, Lokalisation, Beginn, Verlauf, Intensität |\n| Begleitsymptome | Aktuelle Beschwerden, relevante Negativbefunde |\n| Vorerkrankungen | Chronische Erkrankungen, Operationen |\n| Medizinische Daten | Allergien, Medikation, Vitalparameter |\n| Soziales | Beruf, Risikofaktoren, Noxen |\n</kategorisierung>\nErstellen Sie nun die Anamnese nach folgenden Regeln:\n\nEinleitung:\n\nBei Notfallpatienten: \"Die notfallmäßige Vorstellung erfolgt [ggf. mit Notarzt/Rettungsdienst] bei [Hauptbeschwerde].\"\nBei elektiven Patienten: \"Die elektive Vorstellung erfolgt bei [Hauptbeschwerde].\"\n\nHauptbeschwerde:\n\nDetaillierte Beschreibung in 2-3 Sätzen\nChronologische Darstellung des Verlaufs\nErwähnung relevanter Trigger oder Modifikatoren\n\nBegleitsymptome und relevante Negativbefunde (als eigener Absatz).\n\nSystematische Erfassung (jeweils als eigener Absatz), formatiert als **[Kategorie]**:\n\nSozialanamnese/Berufsanamnese\nRisikofaktoren/Noxen\nMedikation\nAllergien\n\nVitalparameter:\n\n**Vitalparameter bei Vorstellung:**\nBlutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl\n\nWichtige Hinweise:\n\nVerwenden Sie ausschließlich Informationen aus den Stichpunkten\nMarkieren Sie fehlende kritische Informationen mit \"[nicht dokumentiert]\"\nKeine Interpretation von Befunden oder Diagnosestellung\nKeine Therapieempfehlungen\nKeine Spekulationen über Kausalzusammenhänge\n\n<diagnoseblock>\nFügen Sie eine Verdachtsdiagnose nach ICD 10 hinzu, die oben steht\nFügen Sie darunter unter **Vordiagnosen:** die anderen bestehenden Vordiagnosen hinzu\nStellen Sie sicher, dass die Vordiagnosen logisch geordnet sind\n</diagnoseblock>\n\n<validierung>\nPrüfen Sie vor Finalisierung:\n- Vollständigkeit der Hauptbeschwerde\n- Sachlich logische Reihenfolge\n- Korrekte medizinische Terminologie\n- Keine Informationen enthalten, die nicht in den Stichpunkten sind\n- Keine Vordiagnosen enthalten, die nicht vorbeschrieben sind\n</validierung>\n\n\n<formatting>\nFormatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnese-Text aus, ohne zusätzliche Kommentare oder Erklärungen. Nach jeder fettgedruckten Kategorisierung sollte ein : und eine neue Zeile eingefügt werden\n</formatting>`,
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
      if (process.env.NODE_ENV === 'development') {
        console.log('Prompt tokens:', promptTokens);
        console.log('Completion tokens:', completionTokens);
        console.log('Total tokens:', totalTokens);
      }
    },
  });

  return result.toDataStreamResponse();
}
