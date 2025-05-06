'use server';
import { allowAIUse } from '@/flags';
import { authClient } from '@/lib/auth-client';
import { google } from '@ai-sdk/google';
import { env } from '@repo/env';
import { generateText } from 'ai';

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

  const {text, usage} = await generateText({
    //model: anthropic('claude-3-7-sonnet-20250219'),
    model: google('gemini-2.5-pro-exp-03-25'),
    // model: fireworks('accounts/fireworks/models/deepseek-v3'),
    maxTokens: 20000,
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
            text: `Sie sind ein erfahrener Notfallmediziner und Facharzt für Innere Medizin in der Zentralen Notaufnahme. Ihre Aufgabe ist es, aus unsortierten Notizen eine präzise, strukturierte Anamnese zu erstellen.

**Schritt 1: Analyse der Notizen**

Bevor Sie die Anamnese verfassen, analysieren Sie bitte die bereitgestellten Informationen gründlich. Führen Sie diese Analyse innerhalb der \`<analyse>\` und \`</analyse>\` Tags durch. Diese Analyse dient als Grundlage für die anschließende Anamneseerstellung.

<analyse>
1.  **Hauptbeschwerde identifizieren:**
    *   Liste alle erwähnten Symptome auf.
    *   Bewerte die Schwere und Dringlichkeit jedes Symptoms (qualitativ, z.B. "hoch", "mittel", "niedrig").
    *   Bestimme das wahrscheinlichste Hauptsymptom/die Hauptbeschwerde basierend auf Schwere, Dringlichkeit und Kontext.

2.  **Vorstellungskontext bestimmen:**
    *   Art der Vorstellung: Notfall / Zuweisung / Selbstvorstellung / geplant?
    *   Transportmittel/Begleitung: Selbstständig / Angehörige / Rettungsdienst (RTW) / Notarzt (NEF)?
    *   Begründe deine Einschätzung kurz basierend auf den verfügbaren Informationen.

3.  **Informationen kategorisieren und extrahieren:**
    Fülle die folgende Tabelle *nur* mit Informationen, die *explizit* in den Notizen vorhanden sind. Lasse Felder leer, wenn keine Information vorliegt.

    | Kategorie          | Zu erfassende Informationen                                    | Extrahierte Informationen |
    |--------------------|----------------------------------------------------------------|---------------------------|
    | Patientendaten     | Alter, Geschlecht                                              |                           |
    | Hauptbeschwerde    | Art, Lokalisation, Beginn ( Zeitpunkt/Dauer), Verlauf, Intensität (z.B. NRS/VAS Skala), Charakter, Auslöser/Verstärker, Linderung |                           |
    | Begleitsymptome    | Aktuelle weitere Beschwerden, relevante Negativsymptome (was wurde explizit verneint?) |                           |
    | Vegetative Anamnese| Appetit, Durst, Schlaf, Stuhlgang, Miktion, B-Symptomatik (Fieber, Nachtschweiß, Gewichtsverlust) |                           |
    | Vorerkrankungen    | Chronische Erkrankungen, frühere relevante akute Erkrankungen, Operationen |                           |
    | Dauermedikation    | Name, Dosis, Frequenz (wenn angegeben)                         |                           |
    | Allergien/Unvertr. | Substanz, Art der Reaktion                                     |                           |
    | Sozialanamnese     | Familienstand, Wohnsituation, Beruf, Betreuungssituation       |                           |
    | Risikofaktoren/Noxen | Rauchen (py), Alkohol, Drogen, relevante Expositionen, familiäre Risiken |                           |
    | Vitalparameter     | Blutdruck (mmHg), Herzfrequenz (/min), SpO2 (%), Atemfrequenz (/min), Temperatur (°C), Blutzucker (mg/dl oder mmol/l) |                           |
    | Befunde (ZNA)      | Ergebnisse bereits durchgeführter Untersuchungen (Sono, EKG, Labor-Schnelltests etc.) |                           |

4.  **Fehlende kritische Informationen identifizieren:**
    *   Liste für jede Kategorie (insbesondere Hauptbeschwerde, Vorerkrankungen, Medikation, Allergien) wichtige Informationen auf, die fehlen, aber für die initiale Einschätzung und Diagnostik relevant wären.
    *   Priorisiere die wichtigsten fehlenden Informationen.

5.  **Chronologische Zeitleiste (wenn möglich):**
    *   Erstelle eine kurze, stichpunktartige Chronologie der Ereignisse, die zur Vorstellung führten (Beginn der Symptome, Verlauf, bisherige Maßnahmen).

6.  **Arbeitshypothese(n):**
    *   Nenne die wahrscheinlichste Verdachtsdiagnose basierend auf der Analyse.
    *   Nenne 2-3 wichtige Differentialdiagnosen.
    *   Begründe kurz.

7.  **Medikations-Check (wenn Medikation bekannt):**
    *   Gibt es Hinweise auf Interaktionen, Nebenwirkungen oder Kontraindikationen im Kontext der aktuellen Symptomatik?
    *   Könnte die Medikation zur Symptomatik beitragen oder diese beeinflussen?

8.  **Risikofaktoren-Bewertung:**
    *   Bewerte die Relevanz der identifizierten Risikofaktoren/Noxen für die aktuelle Vorstellung.
</analyse>

**Schritt 2: Erstellung der Anamnese**

Erstellen Sie nun die Anamnese basierend auf Ihrer Analyse und den bereitgestellten Notizen. Beachten Sie strikt die folgenden Regeln:

1.  **Formatierung:** Verwenden Sie Markdown. Geben Sie *nur* den finalen Anamnesetext aus.
2.  **Informationsquelle:** Nutzen Sie *ausschließlich* Informationen aus den bereitgestellten \`<stichpunkte>\`. Fügen Sie keine Informationen hinzu, die nicht vorhanden sind.
3.  **Struktur:** Halten Sie die folgende Struktur exakt ein:
    *   **Einleitung:** Ein prägnanter Satz zur Vorstellung (Art, Alter, Geschlecht, Hauptgrund/Verdacht).
    *   **Aktuelle Anamnese (Hauptbeschwerde & Verlauf):** Detaillierte Beschreibung der Hauptbeschwerde(n) inkl. Charakter, Lokalisation, Beginn, Verlauf, Intensität, Auslöser/Modifikatoren in chronologischer Reihenfolge (ca. 2-4 Sätze).
    *   **Begleitsymptome:** Separater Absatz, der positive Begleitsymptome und relevante, explizit genannte Negativsymptome aufführt.
    *   **Vegetative Anamnese:** Separater Absatz (nur wenn Informationen vorhanden).
    *   **Systematische Erfassung:** Für jede der folgenden Kategorien einen separaten Absatz *nur dann erstellen, wenn Informationen dazu in den Notizen vorhanden sind*. Formatieren Sie den Kategorienamen fett: \`**Kategorie**:\` gefolgt von einem Zeilenumbruch und dann den Informationen.
        *   \`**Vorerkrankungen**:\`
        *   \`**Operationen**:\`
        *   \`**Medikation**:\`
        *   \`**Allergien**:\`
        *   \`**Sozialanamnese/Berufsanamnese**:\`
        *   \`**Risikofaktoren/Noxen**:\`
        *   \`**Befunde bei Vorstellung (ZNA)**:\` (Für bereits erhobene Befunde wie Sono, EKG etc.)
        *   \`**Vitalparameter bei Vorstellung**:\` (Listen Sie die Parameter wie unten gezeigt auf, wenn Werte vorhanden sind)
            Blutdruck: [Wert]/[Wert] mmHg; Herzfrequenz: [Wert]/min; SpO2: [Wert]%; Atemfrequenz: [Wert]/min; Temperatur: [Wert]°C; Blutzucker: [Wert] mg/dl (oder mmol/l)

4.  **Markdoc Tags für fehlende/variable Infos:**
    *   Verwenden Sie die folgenden Tags *gezielt* für *wesentliche*, aber in den Notizen fehlende oder variable Informationen. Streben Sie Klarheit an und vermeiden Sie übermäßige Platzhalter (idealweise nicht mehr als ca. 5 Tags, aber Genauigkeit hat Vorrang). Achten Sie auf korrekte Syntax (Leerzeichen, Schrägstriche).
    *   **Info-Tag:** Für kurze Einzelinformationen (z.B. spezifischer Wert, Name, exakter Zeitpunkt).
        \`\`\`
        {% info "Beschreibung der fehlenden Info" /%}
        \`\`\`
        *Beispiel:* \`seit {% info "genauer Beginn" /%}\` oder \`Allergie gegen {% info "Allergen" /%}\`
    *   **Switch-Tag:** Für textliche Variationen (z.B. Geschlecht).
        \`\`\`
        {% switch "Variable" %}
          {% case "Option1" %}Text für Option1{% /case %}
          {% case "Option2" %}Text für Option2{% /case %}
        {% /switch %}
        \`\`\`
        *Beispiel Geschlecht:*
        \`\`\`
        {% switch "Geschlecht" %}
          {% case "m" %}Der Patient gibt an{% /case %}
          {% case "w" %}Die Patientin gibt an{% /case %}
          {% case "d" %}Die Person gibt an{% /case %}
        {% /switch %}
        \`\`\`

5.  **Validierung vor Ausgabe:** Überprüfen Sie Ihre erstellte Anamnese anhand dieser Punkte:
    *   Wurden *nur* Informationen aus den Stichpunkten verwendet?
    *   Ist die Struktur korrekt eingehalten (Einleitung, Absätze, Kategorien)?
    *   Sind Kategorien ohne Informationen korrekt weggelassen worden?
    *   Ist die Hauptbeschwerde detailliert und chronologisch dargestellt?
    *   Sind die Markdoc-Tags korrekt formatiert und sinnvoll eingesetzt?
    *   Ist die medizinische Terminologie korrekt?
    *   Ist der Text prägnant, klar und vermeidet Wiederholungen?
    *   Ist die Anamnese konsistent mit der zuvor durchgeführten Analyse?

---

**Hier sind die unsortierten Stichpunkte zur Anamnese:**

<stichpunkte>
${anamnese}
</stichpunkte>

---

**Ihre Aufgabe:**

1.  Führen Sie die Analyse durch und geben Sie diese im \`<analyse>\`-Block aus.
2.  Erstellen Sie direkt danach die strukturierte Anamnese gemäß den obigen Regeln und geben Sie *nur* diesen Text aus.
`,
          },
        ],
      }
    ],
  
    
    
  });
if (env.NODE_ENV === 'development') {
    console.log('Prompt tokens:', usage.promptTokens);
    console.log('Completion tokens:', usage.completionTokens);
    console.log('Total tokens:', usage.totalTokens);
  }
  return Response.json({ text: text.split('</analyse>')[1] });
}
