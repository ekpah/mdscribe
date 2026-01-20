import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamToEventIterator, type } from "@orpc/server";
import { usageEvent } from "@repo/database";
import { env } from "@repo/env";
import { streamText, type UIMessage } from "ai";

import {
	buildUsageEventData,
	extractOpenRouterUsage,
	type StandardUsage,
	type UsageInputData,
	type UsageMetadata,
} from "@/lib/usage-logging";
import { authed } from "@/orpc";
import type { PromptMessage } from "./types";

// Re-export the unified scribe stream handler for document generation
export { scribeStreamHandler } from "./handlers";
export { voiceFillHandler } from "./voiceFill";

const openrouter = createOpenRouter({
	apiKey: env.OPENROUTER_API_KEY as string,
});

const MODEL_ID = "anthropic/claude-sonnet-4-20250514";

/**
 * Local prompt for template completion
 */
interface TemplateCompletionVariables {
	todaysDate: string;
	[key: string]: unknown;
}

function templateCompletionPrompt(
	vars: TemplateCompletionVariables,
): PromptMessage[] {
	return [
		{
			role: "system",
			content: `Du bist ein KI-gestützter Assistent für medizinische Dokumentation. Dein Ziel ist es, auf Basis von Templating mit eckigen und runden Klammern im Stil herausragender Systeme wie Vero Scribe schnell und präzise hochwertige Arztberichte zu generieren.

INSTRUCTIONS
- Top priority is accuracy: only include relevant medical information where specified that is explicitly stated in the source material
- Do not infer, fabricate or hallucinate
- Use professional medical language and terminology

FORMATTING
- Do not add or omit headers from the note template, unless instructed to in the template
- Ensure all relevant clinical information is accurately assigned to its corresponding section based on the note template
- Do not use markdown formatting, bullet points, or em-dashes
- Maintain consistent spacing, layout, and structure as defined in the template
- [square brackets] in templates are fill-in fields
- (round brackets) in templates are rules to follow

MISSING INFORMATION PROTOCOL
- Leave sections blank if no relevant information is provided
- Do NOT use placeholders like "[ ]", "None noted", "Not mentioned"
- Do NOT suggest what information "should" be included
- Do NOT include any lines or statements indicating that information is missing or absent (e.g., "no VS provided", "no labs completed", "no PE findings", "not stated", "none", etc.)
- If a section has no information from the source, leave it completely blank (no text or placeholders)
- If no vital signs are provided, do not mention vital signs at all

### Regeln der Templating-Sprache

- **Platzhalter** stehen in **eckigen Klammern** \`[ ... ]\`. Sie repräsentieren medizinische oder administrative Daten, die direkt aus Transkript, Patientenakte oder Kontextinformationen in den fertigen Bericht übernommen werden sollen.
    - *Beispiel*: \`[Geburtsdatum]\`, \`[Diagnose]\`, \`[Medikation]\`.

- **Anweisungen an die KI** befinden sich in **runden Klammern** \`( ... )\` – unmittelbar nach einem Platzhalter oder einem Abschnitt. Sie definieren, wie Daten einzufügen, zu filtern oder darzustellen sind. Anweisungen müssen exakt befolgt werden.
    - *Beispiel*: \`[Diagnose](Fasse die Diagnose in einem Satz präzise zusammen)\`.

- **Wörtlicher Text** in **Anführungszeichen** \`"..."\` erscheint unverändert in der Ausgabe.

- **Abschnittsüberschriften** wie "Anamnese", "Befund", "Plan" gliedern den Bericht und bleiben als klare Orientierungshilfen bestehen.

### Leitlinien für die Notizgenerierung

1. **Platzhalter erkennen & befüllen**  
    Suche für jeden Platzhalter in den eckigen Klammern die exakten Informationen in den bereitgestellten Inputdaten und ersetze ihn möglichst knapp und fachlich korrekt.

2. **Anweisungen exakt ausführen**  
    Wenn ein Platzhalter eine Anweisung in runden Klammern enthält, wende diese strikt darauf an – z.B. Filterung, Formatierung (Listen, Fließtext), Kürze, Fokussierung auf relevante Daten. Wo keine passenden Daten existieren und „Kein Erfinden“ verlangt ist, bleibt der Bereich leer.

3. **Vorlage behalten, verbatim übernehmen**  
    Sowohl die Struktur (Überschriften, Reihenfolge) als auch alle Zitate in Anführungszeichen werden unverändert übernommen.

4. **Klare & strukturierte Formatierung**  
    Gib alle Details möglichst sauber nach Abschnitten, jeweils mit einer Zeile Abstand aus. In Listen: Jede Information auf eine neue Zeile, wie oft in Vero Scribe-Vorlagen.

5. **Keine Annahmen oder Erfindungen**  
    Nur Informationen aus dem Input verwenden. Fehlen sie, und ist keine Auslassungsregel definiert, lasse den Platz leer oder trage einen Standardwert wie „n.a.“ ein.

<markdoc_tags>
<overview>
Wenn das Geschlecht nicht eindeutig ersichtlich ist, ersetze alle Formulierungen, die geschlechtsabhängig sind durch Platzhalter für beide Geschlechter mittels Switch-Tags.
</overview>
<tag_specifications>
<switch_tag>
<purpose>Auswahl zwischen mehreren Optionen/Szenarien</purpose>
<syntax>{% switch "Label" %}...case tags...{% /switch %}</syntax>
<attributes>

primary (REQUIRED): String - das Label für die Auswahl
</attributes>


<constraints>
- Darf NUR case-Tags als direkte Kinder enthalten
- KEINE Zeilenumbrüche innerhalb von switch-Tags (wird nicht korrekt gerendert)
</constraints>
<structure>
{% switch "Geschlechter" %}{% case "Männlich" %}Herr{% /case %}{% case "Weiblich" %}Frau{% /case %}{% case %}Herr/Frau{% /case %}{% /switch %}
</structure>
</switch_tag>
<case_tag>
<purpose>Einzelne Option innerhalb eines switch-Tags</purpose>
<syntax>{% case "Option" %}...Inhalt...{% /case %}</syntax>
<attributes>

primary (REQUIRED): String - Name der Option
</attributes>


<allowed_content>

Text, strong, em, code, link, inline-Tags
Andere Markdoc-Tags (info)
KEINE Zeilenumbrüche (wird nicht korrekt gerendert)
</allowed_content>
</case_tag>

</markdoc_tags>`,
		},
		{
			role: "user",
			content: `Datum: ${vars.todaysDate}

Eingabe:
${JSON.stringify(vars, null, 2)}`,
		},
	];
}

/**
 * Template completion handler for the chat-based template editor
 * This is a separate use case from the document generation endpoints
 */
export const scribeHandler = authed
	.input(type<{ chatId: string; messages: UIMessage[]; body?: object }>())
	.handler(async ({ input, context }) => {
		// Get today's date for prompt compilation
		const todaysDate = new Date().toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		const promptVariables: TemplateCompletionVariables = {
			todaysDate,
			...input.body,
		};
		const promptMessages = templateCompletionPrompt(promptVariables);

		const result = streamText({
			model: openrouter(MODEL_ID),
			providerOptions: {
				openrouter: {
					usage: { include: true },
					user: context.session.user.email,
				},
			},
			maxOutputTokens: 20_000,
			temperature: 0.3,
			messages: promptMessages,
			onFinish: async (event) => {
				const openRouterUsage = extractOpenRouterUsage(event.providerMetadata);

				await context.db.insert(usageEvent).values(
					buildUsageEventData({
						userId: context.session.user.id || "",
						name: "ai_scribe_generation",
						model: MODEL_ID,
						openRouterUsage,
						standardUsage: event.usage as StandardUsage,
						inputData: (input.body ?? {}) as UsageInputData,
						metadata: {
							promptName: "ai_scribe_template_completion",
							promptSource: "local",
							thinkingEnabled: false,
							streamingMode: true,
						} as UsageMetadata,
						result: event.text,
						reasoning: event.reasoning,
					}),
				);
			},
		});

		return streamToEventIterator(result.toUIMessageStream());
	});
