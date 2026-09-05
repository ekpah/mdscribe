import type { FillInputsContextFile, InputField, PromptMessage } from "@/orpc/scribe/types";

export const FILL_INPUTS_PROMPT_NAME = "input_fill";

const FILL_INPUTS_SYSTEM_PROMPT = `Du füllst medizinische Eingabefelder aus den bereitgestellten Quellen aus.

Quellen (jeweils optional):
- <context>: klinischer Patientenkontext (Diagnosen, Anamnese, Befunde, Epikrise, Notizen).
- <audio_transkripte>: transkribierte Diktate.
- <datei_kontext>: per OCR aus Dateien extrahierter Text.
- <dateien>: Metadaten angehängter Dateien (zusätzlich als Nachrichtenteile).
- <input_fields>: die auszufüllenden Felder mit exakten Labels, Typen und Metadaten; keine Patientendaten.

Antworte nur mit JSON:
{
  "fieldValues": {
    "Exaktes Feldlabel": "Wert"
  }
}

Regeln:
- Verwende ausschließlich die exakten Labels aus <input_fields> als Keys.
- Gib nur Felder zurück, für die passende Quellinformationen vorhanden sind.
- Erfinde nichts. Lass Felder ohne passende Quellinformation weg.
- Beachte die Beschreibung/Metadaten in <input_fields> und das Output-Schema.
- Bei berechneten Scores bevorzuge die einzelnen Komponenten, damit der Score aus der Formel berechnet wird.
- Gib einen Score-Wert nur aus, wenn nicht alle Komponenten aus den Quellen belegt werden können. Ein ausgegebener Score-Wert hat Vorrang vor der Berechnung.
- Bei switch muss der Wert exakt eine der options sein.
- Bei boolean nutze true oder false.`;

interface FillInputsPromptInput {
	/** Explicit field definitions, including for providers that only support JSON mode. */
	inputFields: InputField[];
	/** Already-wrapped `<audio_transkripte>` section, if audio was transcribed. */
	audioTranscripts?: string;
	/** Files attached natively to the model; listed here for reference. */
	contextFiles?: FillInputsContextFile[];
	/** Composed `<context>` block from the shared scribe context pipeline. */
	contextXml?: string;
	/** Already-wrapped `<datei_kontext>` section, if files were preprocessed. */
	fileTextContext?: string;
}

const renderContextFilesSection = (files: FillInputsContextFile[]): string => {
	if (files.length === 0) {
		return "";
	}

	const entries = files.map((file) => `- ${file.name} (${file.mimeType})`).join("\n");
	return `<dateien>\n${entries}\n</dateien>`;
};

const buildFillInputsUserPrompt = (input: FillInputsPromptInput): string => {
	const sections = [
		`<input_fields>\n${JSON.stringify(input.inputFields)}\n</input_fields>`,
		input.contextXml,
		input.audioTranscripts,
		input.fileTextContext,
		renderContextFilesSection(input.contextFiles ?? []),
	].filter((section): section is string => Boolean(section?.trim()));

	return sections.join("\n\n");
};

export const composeFillInputsPrompt = (input: FillInputsPromptInput): PromptMessage[] => [
	{ content: FILL_INPUTS_SYSTEM_PROMPT, role: "system" },
	{ content: buildFillInputsUserPrompt(input), role: "user" },
];
