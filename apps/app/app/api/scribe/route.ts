'use server';
import { anthropic } from '@ai-sdk/anthropic';

import { allowAIUse } from '@/flags';
import { env } from '@repo/env';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();
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
            text: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus den folgenden unsortierten Notizen und Vordiagnosen eine präzise Anamnese zu erstellen.\n\nZunächst überprüfen Sie die ungeordneten Stichpunkte zur Anamnese:\n\n<stichpunkte>\n${anamnese}\n</stichpunkte>\n\nBerücksichtigen Sie nun die Liste der Vordiagnosen:\n\n<vordiagnosen>\n${vordiagnosen}\n</vordiagnosen>\n\nBevor Sie die Anamnese erstellen, analysieren und kategorisieren Sie die bereitgestellten Informationen. Führen Sie die Analyse innerhalb der <analysis>-Tags durch:\n\n<analysis>\n1. Identifizieren Sie die Hauptbeschwerde:\n   [Ihre Analyse hier]\n\n2. Bestimmen Sie den Vorstellungskontext:\n   - Art: Notfall/Elektiv\n   - Begleitung: selbstständig/Angehörige/Rettungsdienst/Notarzt\n   [Ihre Analyse hier]\n\n3. Kategorisieren Sie die Informationen:\n   | Kategorie | Zu erfassende Informationen |\n   |-----------|---------------------------|\n   | Patientendaten | Alter, Geschlecht |\n   | Hauptbeschwerde | Art, Lokalisation, Beginn, Verlauf, Intensität |\n   | Begleitsymptome | Aktuelle Beschwerden, relevante Negativbefunde |\n   | Vorerkrankungen | Chronische Erkrankungen, Operationen |\n   | Medizinische Daten | Allergien, Medikation, Vitalparameter |\n   | Soziales | Beruf, Risikofaktoren, Noxen |\n\n   [Ihre kategorisierten Informationen hier]\n\n4. Identifizieren und listen Sie fehlende kritische Informationen auf:\n   [Fehlende Informationen hier auflisten]\n\n5. Erstellen Sie eine chronologische Zeitleiste der Ereignisse in der Patientengeschichte:\n   [Zeitleiste hier]\n\n6. Planen Sie die Struktur der Anamnese:\n   [Skizzieren Sie Ihre geplante Struktur hier]\n\n7. Erwägen Sie die wahrscheinlichste aktuelle Diagnose und 1-2 potenzielle Differentialdiagnosen:\n   [Ihre diagnostischen Überlegungen hier]\n</analysis>\n\nErstellen Sie nun die Anamnese nach folgenden Regeln:\n\n1. Einleitung:\n  - Beginnen Sie mit einem einleitenden Satz, der die Vorstellungsart und die abzuklärende Verdachtsdiagnose oder das Hauptsymptom kurz einordnet.\n\n\n2. Hauptbeschwerde:\n   - Detaillierte Beschreibung in 2-3 Sätzen\n   - Chronologische Darstellung des Verlaufs\n   - Erwähnung relevanter Auslöser oder Modifikatoren\n\n3. Begleitsymptome und relevante Negativbefunde (als separater Absatz).\n\n4. Systematische Erfassung (jeweils als separater Absatz), wenn vorhanden, formatiert als **[Kategorie]**:\n   - Sozialanamnese/Berufsanamnese\n   - Risikofaktoren/Noxen\n   - Medikation\n   - Allergien\n   - Sonographie/TTE/andere in der ZNA durchgeführte Untersuchungen\n\n5. Vitalparameter:\n   **Vitalparameter bei Vorstellung:**\n   Blutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl\n\nWichtige Hinweise:\n- Verwenden Sie nur Informationen aus den bereitgestellten Notizen\n\nAktualisieren Sie nach der Anamnese den Diagnoseblock:\n\n<diagnoseblock>\n- Fügen Sie oben eine Verdachtsdiagnose gemäß ICD 10 hinzu\n- Listen Sie andere bestehende Vordiagnosen unter **Vordiagnosen:** auf\n- Stellen Sie sicher, dass die Vordiagnosen logisch geordnet sind\n</diagnoseblock>\n\nÜberprüfen Sie vor der Fertigstellung Ihre Anamnese:\n\n<validierung>\nPrüfen Sie auf:\n- Vollständigkeit der Hauptbeschwerde\n- Logisch kohärente Abfolge\n- Korrekte medizinische Terminologie\n- Keine Informationen enthalten, die nicht in den Notizen stehen\n- Keine Vordiagnosen enthalten, die nicht vorbeschrieben sind\n- Keine Vordiagnose weggelassen, die vorbeschrieben war\n</validierung>\n\nFormatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnesetext aus, ohne zusätzliche Kommentare oder Erklärungen. Fügen Sie nach jeder fettgedruckten Kategorie einen Doppelpunkt und einen Zeilenumbruch ein.\n\nBeispielstruktur (kopieren Sie nicht den Inhalt, sondern nur das Format):\n\n\`\`\`markdown\nDie notfallmäßige Vorstellung erfolgt bei starken Brustschmerzen zur weiteren Abklärung. Der 55-jährige Patient selbst klagt über...\n\nBegleitsymptome: ...\n\n**Sozialanamnese/Berufsanamnese:**\n...\n\n**Risikofaktoren/Noxen:**\n...\n\n**Medikation:**\n...\n\n**Allergien:**\n...\n\n**Vitalparameter bei Vorstellung:**\nBlutdruck: 140/90 mmHg; Herzfrequenz: 88/min; SpO2: 97%; Atemfrequenz: 18/min; Temperatur: 37.2°C; Blutzucker: 110 mg/dl\n\n<diagnoseblock>\nVerdachtsdiagnose: ...\n\n**Vordiagnosen:**\n...\n</diagnoseblock>`,
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '<analysis>',
          },
        ],
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
