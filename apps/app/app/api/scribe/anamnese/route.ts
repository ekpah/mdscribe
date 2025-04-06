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
            text: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus unsortierten Notizen eine präzise Anamnese zu erstellen.

Bevor Sie die Anamnese erstellen, analysieren Sie bitte die bereitgestellten Informationen. Führen Sie diese Analyse in den <anamnese_analyse>-Tags durch:

<analyse>
1. Hauptbeschwerde identifizieren:
   - Liste alle erwähnten Symptome auf
   - Bewerte die Schwere und Dringlichkeit jedes Symptoms
   - Bestimme das Hauptsymptom basierend auf Schwere und Relevanz

2. Vorstellungskontext bestimmen:
   - Art: Notfall/Elektiv
   - Begleitung: selbstständig/Angehörige/Rettungsdienst/Notarzt
   - Begründe deine Einschätzung basierend auf den verfügbaren Informationen

3. Informationen kategorisieren:
   | Kategorie | Zu erfassende Informationen |
   |-----------|---------------------------|
   | Patientendaten | Alter, Geschlecht |
   | Hauptbeschwerde | Art, Lokalisation, Beginn, Verlauf, Intensität |
   | Begleitsymptome | Aktuelle Beschwerden, relevante Negativbefunde |
   | Vorerkrankungen | Chronische Erkrankungen, Operationen |
   | Medizinische Daten | Allergien, Medikation, Vitalparameter |
   | Soziales | Beruf, Risikofaktoren, Noxen |

   Fülle jede Kategorie mit den verfügbaren Informationen aus den Stichpunkten

4. Fehlende kritische Informationen identifizieren:
   - Liste für jede Kategorie fehlende wichtige Informationen auf
   - Priorisiere die fehlenden Informationen nach ihrer Wichtigkeit für die Diagnose

5. Detaillierte chronologische Zeitleiste der Ereignisse erstellen:
   - Notiere jeden erwähnten Zeitpunkt oder Zeitraum
   - Ordne alle Symptome, Behandlungen und relevanten Ereignisse chronologisch
   - Identifiziere mögliche Zusammenhänge zwischen Ereignissen

6. Struktur der Anamnese planen:
   - Skizziere die geplante Struktur unter Berücksichtigung aller Kategorien
   - Stelle sicher, dass die Struktur logisch aufgebaut ist und alle wichtigen Informationen enthält

7. Wahrscheinlichste aktuelle Diagnose und 2-3 potenzielle Differentialdiagnosen erwägen:
   - Begründe jede Diagnose basierend auf den vorhandenen Symptomen und Informationen
   - Berücksichtige mögliche Ausschlussdiagnosen

8. Medikationsanalyse:
   - Liste alle erwähnten Medikamente auf
   - Identifiziere mögliche Wechselwirkungen oder Kontraindikationen
   - Überlege, ob die Medikation mit den aktuellen Symptomen in Zusammenhang stehen könnte

9. Risikofaktoren und Noxen analysieren:
   - Identifiziere alle erwähnten Risikofaktoren und Noxen
   - Bewerte ihre mögliche Relevanz für die aktuelle Vorstellung
</analyse>

Erstellen Sie nun die Anamnese nach folgenden Regeln:

1. Einleitung:
   - Beginnen Sie mit einem einleitenden Satz, der die Vorstellungsart und die abzuklärende Verdachtsdiagnose oder das Hauptsymptom kurz einordnet.

2. Hauptbeschwerde:
   - Detaillierte Beschreibung in 2-3 Sätzen
   - Chronologische Darstellung des Verlaufs
   - Erwähnung relevanter Auslöser oder Modifikatoren

3. Begleitsymptome und relevante Negativbefunde (als separater Absatz).

4. Systematische Erfassung (jeweils als separater Absatz), wenn vorhanden, formatiert als **[Kategorie]**:
   - Sozialanamnese/Berufsanamnese
   - Risikofaktoren/Noxen
   - Medikation
   - Allergien
   - Sonographie/TTE/andere in der ZNA durchgeführte Untersuchungen

5. Vitalparameter:
   **Vitalparameter bei Vorstellung:**
   Blutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl

Wichtige Hinweise:
- Verwenden Sie nur Informationen aus den bereitgestellten Notizen
- Nutzen Sie die folgenden Markdoc-Tags für fehlende oder variable Informationen:

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
       {% case "m" %}Der Patient berichtet über{% /case %}
       {% case "w" %}Die Patientin berichtet über{% /case %}
     {% /switch %}
     \`\`\`

Überprüfen Sie vor der Fertigstellung Ihre Anamnese:

<validierung>
Prüfen Sie auf:
- Vollständigkeit der Hauptbeschwerde
- Logisch kohärente Abfolge
- Korrekte medizinische Terminologie
- Korrekte Syntax der Markdoc-Tags (besonders auf korrekte Leerzeichen und Schrägstriche achten)
- Unklare oder unbekannte Informationen durch Markdoc-Tags ersetzt
- Nutze nicht mehr als 5 Markdoc-Tags. Sollte zu einer Kategorie gar keine Informationen vorhanden sein, lasse diese stattdessen weg und nutze Markdoc-Tags für die Bereiche, wo teilweise Informationen vorhanden sind.
- Schreibe prägnant und klar. Nenne insbesondere jede Information nur einmal.
</validierung>

Formatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnesetext aus, ohne zusätzliche Kommentare oder Erklärungen. Fügen Sie nach jeder fettgedruckten Kategorie einen Doppelpunkt und einen Zeilenumbruch ein.

Hier ist ein Beispiel für die Struktur und die korrekte Verwendung der Markdoc-Tags(kopieren Sie nicht den Inhalt, sondern nur das Format):

Die notfallmäßige Vorstellung erfolgt bei {% info "Hauptsymptom" /%} zur weiteren Abklärung. Der {% info "Alter" /%}-jährige {% switch "Geschlecht" %}{% case "m" %}Patient klagt über{% /case %}{% case "w" %}Patientin klagt über{% /case %}{% /switch %} seit {% info "Zeitraum" /%} bestehende Beschwerden.
Begleitsymptome: {% info "Begleitsymptome" /%}
Sozialanamnese/Berufsanamnese:
{% info "Sozialanamnese" /%}
Risikofaktoren/Noxen:
{% info "Risikofaktoren" /%}
Medikation:
{% info "Medikation" /%}
Allergien:
{% info "Allergien" /%}
Vitalparameter bei Vorstellung:
Blutdruck: {% info "Blutdruck" /%} mmHg; Herzfrequenz: {% info "Herzfrequenz" /%}/min; SpO2: {% info "SpO2" /%}%; Atemfrequenz: {% info "Atemfrequenz" /%}/min; Temperatur: {% info "Temperatur" /%}°C; Blutzucker: {% info "Blutzucker" /%} mg/dl

Hier sind die unsortierten Stichpunkte zur Anamnese:

<stichpunkte>
${anamnese}
</stichpunkte>

Erstellen Sie nun die Anamnese nach obenstehenden Regeln.`,
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
      if (env.NODE_ENV === 'development') {
        console.log('Prompt tokens:', promptTokens);
        console.log('Completion tokens:', completionTokens);
        console.log('Total tokens:', totalTokens);
      }
    },
  });

  return result.toDataStreamResponse();
}
