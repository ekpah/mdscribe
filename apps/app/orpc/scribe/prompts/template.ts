// Prompt for generating text straight from a template: one clinical core
// prompt plus the template itself (content, instructions, examples). All
// document-specific rules live in the template, so there is no harness.
import { getTemplateSections } from "@/features/template-tags/sections";
import type { TemplateSection } from "@/features/template-tags/sections";
import { hasContent, toTrimmedString, todaysDateDE } from "@/orpc/scribe/_lib/text";
import { MARKDOC_TAG_GUIDANCE } from "@/orpc/scribe/context/template/guidance";
import type { PromptMessage } from "@/orpc/scribe/types";

// The model answers a sectioned template in the template's own section tags.
const SECTION_TAG_GUIDANCE = MARKDOC_TAG_GUIDANCE.replace(
	"- Gib in der finalen Ausgabe niemals Markdoc-Syntax aus (kein {% ... %}).",
	"- Gib in der finalen Ausgabe außer den {% section %}-Rahmen niemals Markdoc-Syntax aus (kein weiteres {% ... %}).",
);

/** How background material (`<kontext>`) is used; shared with the documentation agent. */
export const BACKGROUND_RULE =
	"- <kontext> enthält Hintergrundinformationen von vor der aktuellen Vorstellung (z. B. Vorbriefe, Vordiagnosen, Vorbefunde, Laborlisten). Es ist Faktenquelle, wird aber nicht abgeschrieben: nur medizinisch Relevantes in eigenen Worten übernehmen; keine Listen normwertiger Laborwerte, keine organisatorischen oder privaten Notizen, keine teaminternen Bemerkungen; im Verlauf verworfene Verdachtsdiagnosen nicht als Diagnose führen.";

/** A text input as the model sees it; citations cite it by `id` and show `name`. */
export interface NamedInput {
	id: string;
	name: string;
	text: string;
}

/**
 * The text fields of a request, in prompt order, each rendered as `<tag id="…">`:
 * the notes on the current presentation and the background from before it.
 */
const TEXT_INPUTS = [
	{ id: "notes", name: "Notizen", tag: "notizen" },
	{ id: "background", name: "Hintergrundinformationen", tag: "kontext" },
] as const;

export type TextInputId = (typeof TEXT_INPUTS)[number]["id"];
export const TEXT_INPUT_IDS = TEXT_INPUTS.map((input) => input.id);

/** Display name of a text input id, as citations show it. */
export const inputName = (id: string): string =>
	TEXT_INPUTS.find((input) => input.id === id)?.name ?? id;

const renderInput = ({ id, tag }: (typeof TEXT_INPUTS)[number], text: string | undefined): string =>
	hasContent(text) ? `<${tag} id="${id}">\n${text.trim()}\n</${tag}>` : "";

/** Background material for the prompt; empty when there is none. */
export const renderBackground = (background?: string): string =>
	renderInput(TEXT_INPUTS[1], background);

const corePrompt = (markdocGuidance: string) => `<system_role>
Sie sind ein erfahrener Klinikarzt mit ausgeprägter schriftlicher Ausdrucksfähigkeit und fundierter medizinischer Beurteilungskompetenz. Sie erstellen ärztliche Dokumente anhand der Vorlage in <template>.
</system_role>

<grundregeln>
- Inhalte stammen AUSSCHLIESSLICH aus den Eingaben (<notizen>, <dokument>, <kontext>, Dateien, Audio). Keine Spekulationen, keine erfundenen Fakten und keine Standardannahmen (z. B. „keine Allergien“, Normalwerte, unauffällige Befunde), wenn sie nicht belegt sind.
- Bei unklaren oder widersprüchlichen Angaben die Information weglassen oder die Unsicherheit bzw. die Möglichkeiten ausdrücken.
- Die Vorlage gibt Struktur, Form und Stil vor. Inhalte aus Vorlage und Beispielen NIEMALS übernehmen.
- <anweisungen> der Vorlage sind verbindlich. Text in {% ai %}...{% /ai %} oder ((...)) ist eine Anweisung für Sie und wird nie ausgegeben.
- <notizen> sind die primäre Eingabe. <dokument> enthält bereits geschriebene Abschnitte: als Faktenquelle nutzen, aber nicht wiederholen.
${BACKGROUND_RULE}
- <user_context> beschreibt den Verfasser, nicht den Patienten.
- Geschlecht und Name des Patienten nur verwenden, wenn sie in den Eingaben belegt sind; sonst neutral formulieren.
- Fachlich korrekte, vollständige Begriffe statt Notiz-Kürzeln, sofern die Vorlage nichts anderes vorgibt.
</grundregeln>

<stil>
- Ärztlich-sachlich, kompakt und ohne Ausschmückungen; natürliches medizinisches Deutsch.
- Konsistente Zeitform, Perspektive und Formulierung innerhalb des Dokuments.
- Medizinische Fachterminologie korrekt; Abkürzungen nur, wenn etabliert.
</stil>

<markdoc_tags>
${markdocGuidance}
</markdoc_tags>`;

const PLAIN_OUTPUT = `<ausgabe>
Geben Sie ausschließlich den fertigen Text gemäß <template> aus – ohne Titel der Vorlage, ohne Vorbemerkungen, Erklärungen, XML-Tags oder Metakommentare.
</ausgabe>`;

const SECTION_OUTPUT = `<ausgabe>
Die Vorlage besteht aus {% section %}-Abschnitten. Geben Sie jeden verlangten Abschnitt genau einmal in der Reihenfolge der Vorlage aus:
{% section id="…" %}fertiger Text des Abschnitts{% /section %}
Keine Abschnittstitel, keine Vorbemerkungen, kein Text außerhalb der Abschnitte. Abschnitte bauen aufeinander auf; Fakten nicht unnötig zwischen Abschnitten wiederholen.
</ausgabe>`;

interface TemplatePromptTemplate {
	content: string;
	examples: string[];
	information: string;
	title: string;
}

/** Text fields by id; `background` (Hintergrundinformationen) is a fact source that is not copied. */
export interface TemplatePromptInput extends Partial<Record<TextInputId, string>> {
	/** Current section texts, e.g. edited by the user; used as context. */
	sections?: Record<string, string>;
	/** Regenerate only this section; its current text is the draft, the others are context. */
	targetSectionId?: string;
	template: TemplatePromptTemplate;
	todaysDate?: string;
	userContext?: string;
}

const renderTemplate = (template: TemplatePromptTemplate): string => {
	const blocks = [
		`<content>\n${template.content.trim()}\n</content>`,
		hasContent(template.information)
			? `<anweisungen>\n${template.information.trim()}\n</anweisungen>`
			: "",
		template.examples.length > 0
			? `<examples>\n${template.examples.map((example) => `<example>\n${example.trim()}\n</example>`).join("\n")}\n</examples>`
			: "",
	].filter(hasContent);
	return `<template titel="${template.title}">\n${blocks.join("\n")}\n</template>`;
};

const renderDocument = (sections: TemplateSection[], values: Record<string, string>): string => {
	const written = sections.filter((section) => hasContent(values[section.id]));
	if (written.length === 0) {
		return "";
	}
	return `<dokument>\n${written
		.map(
			(section) =>
				`{% section id="${section.id}" title="${section.title}" %}\n${toTrimmedString(values[section.id])}\n{% /section %}`,
		)
		.join("\n")}\n</dokument>`;
};

/**
 * The text input citations may point to: the background. Notes typed for this
 * letter, its own sections and audio are not cited; uploaded files are.
 */
export const evidenceInputs = ({ background }: TemplatePromptInput): NamedInput[] =>
	hasContent(background)
		? [{ id: "background", name: inputName("background"), text: background.trim() }]
		: [];

export const composeTemplatePrompt = (input: TemplatePromptInput): PromptMessage[] => {
	const sections = getTemplateSections(input.template.content);
	const target = sections.find((section) => section.id === input.targetSectionId);
	// A template without sections is one text; regenerating it rewrites its current draft.
	const draft =
		sections.length === 0 && input.targetSectionId
			? toTrimmedString(input.sections?.[input.targetSectionId])
			: "";
	const user = [
		`Das heutige Datum ist der ${input.todaysDate ?? todaysDateDE()}.`,
		renderTemplate(input.template),
		input.userContext ?? "",
		renderDocument(sections, input.sections ?? {}),
		target
			? `<aufgabe>Schreiben Sie ausschließlich den Abschnitt „${target.title}“ (id="${target.id}") neu. Sein bisheriger Text in <dokument> ist Entwurf und Faktenquelle; die übrigen Abschnitte sind verbindlicher Kontext.</aufgabe>`
			: "",
		draft
			? `<entwurf>\n${draft}\n</entwurf>\n<aufgabe>Schreiben Sie den Text neu. Der bisherige Text in <entwurf> ist Entwurf und Faktenquelle.</aufgabe>`
			: "",
		...TEXT_INPUTS.map((field) => renderInput(field, input[field.id])),
	].filter(hasContent);

	return [
		{
			content:
				sections.length > 0
					? `${corePrompt(SECTION_TAG_GUIDANCE)}\n\n${SECTION_OUTPUT}`
					: `${corePrompt(MARKDOC_TAG_GUIDANCE)}\n\n${PLAIN_OUTPUT}`,
			role: "system",
		},
		{ content: user.join("\n\n"), role: "user" },
	];
};
