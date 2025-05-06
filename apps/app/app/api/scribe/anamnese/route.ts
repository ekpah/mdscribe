'use server';
import { allowAIUse } from '@/flags';
import { authClient } from '@/lib/auth-client';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { env } from '@repo/env';
import { CoreMessage, generateText } from 'ai';


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


  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus den folgenden unsortierten Notizen und Vordiagnosen eine präzise Anamnese zu erstellen.\n\nZunächst überprüfen Sie die ungeordneten Stichpunkte zur Anamnese:\n\n<stichpunkte>\n${anamnese}\n</stichpunkte>\n\nBevor Sie die Anamnese erstellen, analysieren und kategorisieren Sie die bereitgestellten Informationen. Führen Sie die Analyse innerhalb der <analyse>-Tags durch:\n\n<analysis>\n1. Identifizieren Sie die Hauptbeschwerde:\n   [Ihre Analyse hier]\n\n2. Bestimmen Sie den Vorstellungskontext:\n   - Art: Notfall/Elektiv\n   - Begleitung: selbstständig/Angehörige/Rettungsdienst/Notarzt\n   [Ihre Analyse hier]\n\n3. Kategorisieren Sie die Informationen:\n   | Kategorie | Zu erfassende Informationen |\n   |-----------|---------------------------|\n   | Patientendaten | Alter, Geschlecht |\n   | Hauptbeschwerde | Art, Lokalisation, Beginn, Verlauf, Intensität |\n   | Begleitsymptome | Aktuelle Beschwerden, relevante Negativbefunde |\n   | Vorerkrankungen | Chronische Erkrankungen, Operationen |\n   | Medizinische Daten | Allergien, Medikation, Vitalparameter |\n   | Soziales | Beruf, Risikofaktoren, Noxen |\n\n   [Ihre kategorisierten Informationen hier]\n\n4. Identifizieren und listen Sie fehlende kritische Informationen auf:\n   [Fehlende Informationen hier auflisten]\n\n5. Erstellen Sie eine chronologische Zeitleiste der Ereignisse in der Patientengeschichte:\n   [Zeitleiste hier]\n\n6. Planen Sie die Struktur der Anamnese:\n   [Skizzieren Sie Ihre geplante Struktur hier]\n\n7. Erwägen Sie die wahrscheinlichste aktuelle Diagnose und 1-2 potenzielle Differentialdiagnosen:\n   [Ihre diagnostischen Überlegungen hier]\n</analysis>\n\nErstellen Sie nun die Anamnese nach folgenden Regeln:\n\n1. Einleitung:\n  - Beginnen Sie mit einem einleitenden Satz, der die Vorstellungsart und die abzuklärende Verdachtsdiagnose oder das Hauptsymptom kurz einordnet.\n\n\n2. Hauptbeschwerde:\n   - Detaillierte Beschreibung in 2-3 Sätzen\n   - Chronologische Darstellung des Verlaufs\n   - Erwähnung relevanter Auslöser oder Modifikatoren\n\n3. Begleitsymptome und relevante Negativbefunde (als separater Absatz).\n\n4. Systematische Erfassung (jeweils als separater Absatz), wenn vorhanden, formatiert als **[Kategorie]**:\n   - Sozialanamnese/Berufsanamnese\n   - Risikofaktoren/Noxen\n   - Medikation\n   - Allergien\n   - Sonographie/TTE/andere in der ZNA durchgeführte Untersuchungen\n\n5. Vitalparameter:\n   **Vitalparameter bei Vorstellung:**\n   Blutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl\n\nWichtige Hinweise:\n- Verwenden Sie nur Informationen aus den bereitgestellten Notizen\n\nAktualisieren Sie nach der Anamnese den Diagnoseblock:\n\n<diagnoseblock>\n- Fügen Sie oben eine Verdachtsdiagnose gemäß ICD 10 hinzu\n- Listen Sie andere bestehende Vordiagnosen unter **Vordiagnosen:** auf\n- Stellen Sie sicher, dass die Vordiagnosen logisch geordnet sind\n</diagnoseblock>\n\nÜberprüfen Sie vor der Fertigstellung Ihre Anamnese:\n\n<validierung>\nPrüfen Sie auf:\n- Vollständigkeit der Hauptbeschwerde\n- Logisch kohärente Abfolge\n- Korrekte medizinische Terminologie\n- Keine Informationen enthalten, die nicht in den Notizen stehen\n- Keine Vordiagnosen enthalten, die nicht vorbeschrieben sind\n- Keine Vordiagnose weggelassen, die vorbeschrieben war\n</validierung>\n\nFormatieren Sie Ihre Antwort in Markdown. Geben Sie nur den Anamnesetext aus, ohne zusätzliche Kommentare oder Erklärungen. Fügen Sie nach jeder fettgedruckten Kategorie einen Doppelpunkt und einen Zeilenumbruch ein.\n\nBeispielstruktur (kopieren Sie nicht den Inhalt, sondern nur das Format):\n\n\`\`\`markdown\nDie notfallmäßige Vorstellung erfolgt bei starken Brustschmerzen zur weiteren Abklärung. Der 55-jährige Patient selbst klagt über...\n\nBegleitsymptome: ...\n\n**Sozialanamnese/Berufsanamnese:**\n...\n\n**Risikofaktoren/Noxen:**\n...\n\n**Medikation:**\n...\n\n**Allergien:**\n...\n\n**Vitalparameter bei Vorstellung:**\nBlutdruck: 140/90 mmHg; Herzfrequenz: 88/min; SpO2: 97%; Atemfrequenz: 18/min; Temperatur: 37.2°C; Blutzucker: 110 mg/dl\n\n<diagnoseblock>\nVerdachtsdiagnose: ...\n\n**Vordiagnosen:**\n...\n</diagnoseblock>`,
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
  ]


  const experimentalMessages = [
    {
      role: 'user',
      content: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus unsortierten Notizen eine präzise, strukturierte Anamnese zu erstellen.

Schritt 1: Analyse der Notizen

Bevor Sie die Anamnese verfassen, analysieren Sie bitte die bereitgestellten Informationen gründlich. Führen Sie diese Analyse innerhalb der <analyse> und </analyse> Tags durch. Diese Analyse dient als Grundlage für die anschließende Anamneseerstellung.

<analyse>
1. **Hauptbeschwerde identifizieren:**
* Liste alle erwähnten Symptome auf.
* Bewerte die Schwere und Dringlichkeit jedes Symptoms (qualitativ, z.B. "hoch", "mittel", "niedrig", oder NRS/VAS wenn vorhanden).
* Bestimme das wahrscheinlichste Hauptsymptom/die Hauptbeschwerde basierend auf Schwere, Dringlichkeit und Kontext.
Vorstellungskontext bestimmen:
Art der Vorstellung: Notfall / Zuweisung / Selbstvorstellung / geplant?
Transportmittel/Begleitung: Selbstständig / Angehörige / Rettungsdienst (RTW) / Notarzt (NEF)?
Begründe deine Einschätzung kurz basierend auf den verfügbaren Informationen.
Informationen kategorisieren und extrahieren:
Fülle die folgende Tabelle nur mit Informationen, die explizit in den Notizen vorhanden sind. Lasse Felder leer, wenn keine Information vorliegt.
Kategorie	Zu erfassende Informationen	Extrahierte Informationen
Patientendaten	Name (falls vorhanden), Alter, Geschlecht	
Hauptbeschwerde	Art, Lokalisation, Beginn (Zeitpunkt/Dauer), Verlauf, Intensität (z.B. NRS/VAS Skala), Charakter, Auslöser/Verstärker, Linderung	
Begleitsymptome	Aktuelle weitere Beschwerden, relevante Negativsymptome (was wurde explizit verneint?)	
Vegetative Anamnese	Appetit, Durst, Schlaf, Stuhlgang, Miktion, B-Symptomatik (Fieber, Nachtschweiß, Gewichtsverlust)	
Vorerkrankungen	Chronische Erkrankungen, frühere relevante akute Erkrankungen	
Operationen	Art der OP, Zeitpunkt (wenn bekannt)	
Dauermedikation	Name, Dosis, Frequenz (wenn angegeben)	
Allergien/Unvertr.	Substanz, Art der Reaktion	
Sozialanamnese	Familienstand, Wohnsituation, Beruf, Betreuungssituation	
Risikofaktoren/Noxen	Rauchen (py), Alkohol, Drogen, relevante Expositionen, familiäre Risiken	
Vitalparameter	Blutdruck (mmHg), Herzfrequenz (/min), SpO2 (%), Atemfrequenz (/min), Temperatur (°C), Blutzucker (mg/dl oder mmol/l)	
Befunde (ZNA)	Ergebnisse bereits durchgeführter Untersuchungen (Sono, EKG, Labor-Schnelltests etc.)	
Fehlende kritische Informationen identifizieren:
Liste für jede Kategorie (insbesondere Hauptbeschwerde, Vorerkrankungen, Medikation, Allergien) wichtige Informationen auf, die fehlen, aber für die initiale Einschätzung und Diagnostik relevant wären.
Priorisiere die wichtigsten fehlenden Informationen. Dies hilft zu entscheiden, ob im Anamnesetext ein {% info %}-Tag für eine spezifisch als fehlend erkannte, kritische Information gesetzt werden soll.
Chronologische Zeitleiste (wenn möglich):
Erstelle eine kurze, stichpunktartige Chronologie der Ereignisse, die zur Vorstellung führten (Beginn der Symptome, Verlauf, bisherige Maßnahmen).
Arbeitshypothese(n):
Nenne die wahrscheinlichste Verdachtsdiagnose basierend auf der Analyse.
Nenne 2-3 wichtige Differentialdiagnosen.
Begründe kurz.
Medikations-Check (wenn Medikation bekannt):
Gibt es Hinweise auf Interaktionen, Nebenwirkungen oder Kontraindikationen im Kontext der aktuellen Symptomatik?
Könnte die Medikation zur Symptomatik beitragen oder diese beeinflussen?
Risikofaktoren-Bewertung:
Bewerte die Relevanz der identifizierten Risikofaktoren/Noxen für die aktuelle Vorstellung.
</analyse>
Schritt 2: Erstellung der Anamnese

Erstellen Sie nun die Anamnese basierend auf Ihrer Analyse und den bereitgestellten Notizen. Beachten Sie strikt die folgenden Regeln:

Formatierung: Verwenden Sie Markdown. Geben Sie nur den finalen Anamnesetext aus.
Informationsquelle: Nutzen Sie ausschließlich Informationen aus den bereitgestellten <stichpunkte>. Fügen Sie keine Informationen hinzu, die nicht vorhanden sind. Wenn für eine ganze Kategorie keine Informationen vorliegen, lassen Sie diese Kategorie und ihre Überschrift im finalen Text weg.
Struktur: Halten Sie die folgende Struktur exakt ein:
Einleitung: Ein prägnanter Satz zur Vorstellung (Art der Vorstellung, Alter, Geschlecht, Hauptgrund/Verdacht). Verwenden Sie {% info "Patientenname" /%} falls der Name in den Stichpunkten fehlt aber üblicherweise genannt würde.
Aktuelle Anamnese (Hauptbeschwerde & Verlauf): Detaillierte Beschreibung der Hauptbeschwerde(n) inkl. Charakter, Lokalisation, Beginn, Verlauf, Intensität, Auslöser/Modifikatoren in chronologischer Reihenfolge (ca. 2-4 Sätze).
Begleitsymptome: Separater Absatz, der positive Begleitsymptome und relevante, explizit genannte Negativsymptome aufführt.
Vegetative Anamnese: Separater Absatz (nur wenn Informationen vorhanden).
Systematische Erfassung: Für jede der folgenden Kategorien einen separaten Absatz nur dann erstellen, wenn Informationen dazu in den Notizen vorhanden sind. Formatieren Sie den Kategorienamen fett: Kategorie: gefolgt von einem Zeilenumbruch und dann den Informationen.
Vorerkrankungen:
Operationen:
Medikation:
Allergien:
Sozialanamnese/Berufsanamnese:
Risikofaktoren/Noxen:
Befunde bei Vorstellung (ZNA): (Für bereits erhobene Befunde wie Sono, EKG etc.)
Vitalparameter bei Vorstellung: (Listen Sie die Parameter wie unten gezeigt auf, wenn Werte vorhanden sind. Fehlende Parameter weglassen, nicht mit Platzhaltern füllen.)
Blutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl (oder mmol/l)
Markdoc Tags für fehlende/variable Infos (SPARSAM VERWENDEN!):
Grundregel: Bevorzugen Sie das Weglassen von Informationen oder ganzen Sektionen, wenn keine Daten vorliegen. Tags nur dann, wenn ein Platzhalter unbedingt notwendig ist, um den Sinn zu wahren oder eine spezifisch als kritisch fehlend identifizierte Information (siehe Analyse Schritt 4) zu markieren.
Vermeiden Sie übermäßige Platzhalter. Ziel ist ein lesbarer, klinisch sinnvoller Text.
Info-Tag: Für kurze, kritische Einzelinformationen, die fehlen, aber deren Fehlen im Kontext erwähnt werden sollte.
{% info "Beschreibung der kritischen fehlenden Info" /%}

*Beispiel:* "Allergie gegen Penicillin bekannt, Art der Reaktion {% info 'Art der allergischen Reaktion' /%}." (Nur wenn Penicillin-Allergie erwähnt, aber Reaktion unklar). Oder: "Beginn der Symptomatik vor {% info 'genauer Zeitraum' /%}." (Nur wenn der Beginn vage ist, aber eine Präzisierung erwartet wird).
*   **Switch-Tag:** Hauptsächlich für grammatikalische Anpassungen (z.B. Geschlecht).
Use code with caution.
{% switch "Geschlecht" %}
{% case "m" %}Der Patient gibt an{% /case %}
{% case "w" %}Die Patientin gibt an{% /case %}
{% case "d" %}Die Person gibt an{% /case %}
{% case "x" %}Die Person gibt an{% /case %}
{% case "o" %}Die Person gibt an{% /case %}
{% /switch %}

*Beispiel Geschlecht in Einleitung:*
    Ein {% switch "Geschlecht" %}{% case "m" %}Patient{% /case %}{% case "w" %}Patientin{% /case %}{% case "d" %}Person{% /case %}{% case "x" %}Person{% /case %}{% case "o" %}Person{% /case %}{% /switch %}, oder spezifischer: Der/Die {% info "Alter" /%}-jährige Patient:in {% info "Patientenname" /%}

Validierung vor Ausgabe: Überprüfen Sie Ihre erstellte Anamnese anhand dieser Punkte:
Wurden nur Informationen aus den Stichpunkten verwendet?
Ist die Struktur korrekt eingehalten (Einleitung, Absätze, Kategorien)?
Sind Kategorien ohne Informationen korrekt weggelassen worden?
Ist die Hauptbeschwerde detailliert und chronologisch dargestellt?
Sind Markdoc-Tags sparsam und nur bei Notwendigkeit korrekt formatiert und sinnvoll eingesetzt?
Ist die medizinische Terminologie korrekt?
Ist der Text prägnant, klar und vermeidet Wiederholungen sowie unnötige Füllsätze für fehlende Informationen?
Ist die Anamnese konsistent mit der zuvor durchgeführten Analyse?
Hier sind die unsortierten Stichpunkte zur Anamnese:

<stichpunkte>
${anamnese}
</stichpunkte>
Ihre Aufgabe:

Führen Sie die Analyse durch und geben Sie diese im <analyse>-Block aus.
Erstellen Sie direkt danach die strukturierte Anamnese gemäß den obigen Regeln und geben Sie nur diesen Text aus.
Wichtiger Hinweis zur Tag-Nutzung: Das Hauptziel ist eine lesbare und direkt verwendbare Anamnese. Wenn eine Information fehlt und ihr Fehlen den Lesefluss nicht stört oder keinen kritischen Informationsverlust im unmittelbaren Kontext darstellt, lassen Sie sie weg, anstatt einen Tag zu verwenden. Verwenden Sie Tags nur, wenn es für das Verständnis des aktuellen Satzes/Abschnitts essenziell ist oder eine Variable (wie Geschlecht für korrekte Grammatik) darstellt. Der Anamnesetext soll so aussehen, als würde ein Arzt ihn diktieren und dabei nur die vorhandenen Fakten nennen.
`,
    },
  ]



  const { text, usage } = await generateText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    //model: google('gemini-2.5-pro-exp-03-25'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 20000,
    temperature: 1,
    /*experimental_telemetry: {
      isEnabled: true,
      metadata: {
        user: session?.user?.id || 'unknown',
      },
    },*/
    messages: messages,
  });
  if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }
  return Response.json({ text: text.split('</analyse>')[1] });
}
