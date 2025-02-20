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
    model: anthropic('claude-3-5-sonnet-latest'),
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
            text: '<examples>\n<example>\n<STICHPUNKTE>\nweiblich 85, synkope im sitzen biem essen, vorher leichtes unwohlsein, keine dyspnoe, keine ap, keine suspekten kriterien nach san francisco syncope rule\n</STICHPUNKTE>\n<ideal_output>\n<analyse_und_kategorisierung>\nHauptbeschwerde: Synkope\nKontext der Vorstellung: Notfallmäßig\n\nKategorisierung:\n- Patientendemographie: Weiblich, 85 Jahre\n- Hauptbeschwerde: Synkope im Sitzen beim Essen\n- Zusätzliche Symptome: Leichtes Unwohlsein vor Synkope\n- Relevante Vorerkrankungen: Keine erwähnt\n- Vitalparameter: Nicht angegeben\n\nFehlende kritische Informationen: Aktuelle Vitalparameter, genaue Dauer des Unwohlseins, Begleitumstände nach der Synkope, Art der Vorstellung\n</analyse_und_kategorisierung>\n\nDie notfallmäßige Vorstellung erfolgt nach einer Synkope im Sitzen während des Essens. Die Patientin selbst berichtet, dass ihr unwohl gewesen sei und sie dann bewusstlos geworden sei. Dyspnoe oder Angina pectoris werden verneint.\n\nEs liegen keine suspekten Kriterien nach der San Francisco Syncope Rule vor.\n\nVitalparameter: RR XX/XX mmHg, Puls XX/min, SpO2 XX%, AF XX/min, Temperatur XX°C, Blutzucker XX mg/dl\n</ideal_output>\n</example>\n<example>\n<STICHPUNKTE>\nmännlich 62, überweisung von ha,  starke bauchschmerzen seit 6h, übelkeit und erbrechen, kein stuhlgang seit 2 tagen, voher normaler stuhlgang oder blut oder diarrhoe, fieber 38.5°C, bekannte divertikulitis\n</STICHPUNKTE>\n<ideal_output>\n<analyse_und_kategorisierung>\nHauptbeschwerde: Starke Bauchschmerzen\nKontext der Vorstellung: Notfallmäßig\nArt der Vorstellung: Überweisung vom Hausarzt\n\nKategorisierung:\n- Patientendemographie: Männlich, 62 Jahre\n- Hauptbeschwerde: Starke Bauchschmerzen seit 6 Stunden\n- Zusätzliche Symptome: Übelkeit, Erbrechen, Obstipation seit 2 Tagen, Fieber\n- Relevante Vorerkrankungen: Bekannte Divertikulitis\n- Vitalparameter: Temperatur 38,5°C\n\nFehlende kritische Informationen: Vollständige Vitalparameter, Lokalisation der Bauchschmerzen\n</analyse_und_kategorisierung>\n\nDie notfallmäßige Vorstellung erfolgt nach Einweisung durch den Hausarzt bei starken Bauchschmerzen seit 6 Stunden. Der Patient selbst berichtet außerdem von Übelkeit und Erbrechen. Er habe seit 2 Tagen keinen Stuhlgang, zuvor sei der Stuhlgang normal und ohne Blutbeimengungen oder Diarrhoe gewesen.\n\nRelevante Vorerkrankung: Bekannte Divertikulitis.\n\nVitalparameter: RR XX/XX mmHg, Puls XX/min, SpO2 XX%, AF XX/min, Temperatur 38,5°C, Blutzucker XX mg/dl\n</ideal_output>\n</example>\n<example>\n<STICHPUNKTE>\nmännlich 55, plötzliche starke kopfschmerzen vor 2h, übelkeit, lichtempfindlichkeit, kein trauma, hypertonie bekannt, keine neurologischen ausfälle, familienanamnese negativ für aneurysmen, rr160/90, puls 105\n</STICHPUNKTE>\n<ideal_output>\n<analyse_und_kategorisierung>\nHauptbeschwerde: Plötzliche starke Kopfschmerzen\nKontext der Vorstellung: Notfallmäßig\nArt der Vorstellung: Nicht spezifiziert\n\nKategorisierung:\n- Patientendemographie: Männlich, 55 Jahre\n- Hauptbeschwerde: Plötzliche starke Kopfschmerzen seit 2 Stunden\n- Zusätzliche Symptome: Übelkeit, Lichtempfindlichkeit\n- Relevante Vorerkrankungen: Arterielle Hypertonie\n- Vitalparameter: RR 160/90 mmHg, Puls 105/min\n\nFehlende kritische Informationen: Art der Vorstellung, vollständige Vitalparameter\n</analyse_und_kategorisierung>\n\nDie notfallmäßige Vorstellung erfolgt bei plötzlichen starken Kopfschmerzen vor 2 Stunden. Der Patient berichtet ebenso von Übelkeit und Lichtempfindlichkeit. Ein Trauma ist nicht erinnerlich. Ebenso bestehen subjektiv keine neurologischen Ausfälle.\n\nRelevante Vorerkrankung: Arterielle Hypertonie. Familienanamnese negativ für intrakranielle Aneurysmen.\n\nVitalparameter: RR 160/90 mmHg, Puls 105/min, SpO2 XX%, AF XX/min, Temperatur XX°C, Blutzucker XX mg/dl\n</ideal_output>\n</example>\n</examples>\n\n',
          },
          {
            type: 'text',
            text: `Sie sind eine erfahrene medizinische Fachkraft in der Notaufnahme eines Krankenhauses. Ihre Aufgabe ist es, aus kurzen Stichpunkten eine ausführliche und präzise medizinische Anamnese zu erstellen. Hier sind die Stichpunkte für den aktuellen Patienten:\n\n<stichpunkte>\n${prompt}\n</stichpunkte>\n\nBitte erstellen Sie aus diesen Stichpunkten eine zusammenhängende, gut strukturierte Anamnese. Befolgen Sie dabei diese Anweisungen:\n\n1. Führen Sie zunächst eine Analyse in <analyse_und_kategorisierung> Tags durch:\n   - Identifizieren Sie die Hauptbeschwerde, den Kontext der Vorstellung (notfallmäßig oder elektiv), die Art der Vorstellung (selbstständig, mit Angehörigen, Überweisung, Rettungsdienst, Notarzt).\n   - Kategorisieren Sie die Informationen in folgende Abschnitte: Patientendemographie, Hauptbeschwerde, zusätzliche Symptome, relevante Vorerkrankungen und vorhandene Vitalparameter.\n   - Listen Sie jede Information unter der entsprechenden Kategorie auf.\n   - Identifizieren Sie fehlende kritische Informationen.\n\n2. Beginnen Sie die Anamnese mit dem Kontext der Vorstellung und der Hauptbeschwerde. Diese sollte stets mit einer ähnlichen Floskel beginnen wie:\n - Die notfallmäßige Vorstellung erfolgt bei ...\n - Die notfallmäßige Vorstellung erfolgt in Begleitung des Notarztes bei V.a. ACS.\n - Die selbstständige notfallmäßige Vorstellung erfolgt bei ...\n\n3. Detaillieren Sie die Hauptbeschwerde, einschließlich Dauer, Art und Schwere der Symptome.\n\n4. Erwähnen Sie zusätzliche Beschwerden oder relevante negative Befunde in separaten, kurzen Absätzen.\n\n5. Fügen Sie relevante Vorerkrankungen oder Risikofaktoren hinzu, falls in den Stichpunkten erwähnt.\n\n6. Schließen Sie mit den Vitalparametern ab. Verwenden Sie diese Vorlage und füllen Sie bekannte Werte ein. Für fehlende Werte verwenden Sie \"XX\":\n   Vitalparameter: RR XX/XX mmHg, Puls XX/min, SpO2 XX%, AF XX/min, Temperatur XX°C, Blutzucker XX mg/dl\n\nWichtige Hinweise:\n- Verwenden Sie einen sachlichen, medizinischen Schreibstil mit vollständigen Sätzen.\n- Vermeiden Sie Einleitungen, Floskeln oder Fragen.\n- Halten Sie sich strikt an die gegebenen Informationen. Machen Sie keine Annahmen oder Ergänzungen, die nicht explizit in den Stichpunkten erwähnt sind.\n- Überprüfen Sie Ihren Text auf Prägnanz und Relevanz, bevor Sie ihn finalisieren.\n\nFormatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnese-Text aus, ohne zusätzliche Kommentare oder Erklärungen.`,
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '<analyse_und_kategorisierung>',
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
