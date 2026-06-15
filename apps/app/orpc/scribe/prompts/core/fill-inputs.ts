import type { FillInputsContextFile, PromptMessage } from "@/orpc/scribe/types";

export const FILL_INPUTS_PROMPT_NAME = "input_fill";

const FILL_INPUTS_SYSTEM_PROMPT = `Du füllst medizinische Eingabefelder aus den bereitgestellten Quellen aus.

Quellen (jeweils optional):
- <context>: klinischer Patientenkontext (Diagnosen, Anamnese, Befunde, Epikrise, Notizen).
- <audio_transkripte>: transkribierte Diktate.
- <datei_kontext>: per OCR aus Dateien extrahierter Text.
- <dateien>: Metadaten angehängter Dateien (zusätzlich als Nachrichtenteile).
- Das Output-Schema enthält die exakt auszufüllenden Feldlabels mit Beschreibung.

Antworte nur mit JSON:
{
  "fieldValues": {
    "Exaktes Feldlabel": "Wert"
  }
}

Regeln:
- Verwende exakt die Keys aus dem Output-Schema.
- Erfinde nichts. Wenn du keine Information findest, nutze "".
- Beachte die Beschreibung/Metadaten im Output-Schema.
- Bei switch muss der Wert exakt eine der options sein.
- Bei boolean nutze true oder false.`;

interface FillInputsPromptInput {
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
		input.contextXml,
		input.audioTranscripts,
		input.fileTextContext,
		renderContextFilesSection(input.contextFiles ?? []),
	].filter((section): section is string => Boolean(section?.trim()));

	return sections.length > 0 ? sections.join("\n\n") : "Keine Quellen vorhanden.";
};

export const composeFillInputsPrompt = (input: FillInputsPromptInput): PromptMessage[] => [
	{ content: FILL_INPUTS_SYSTEM_PROMPT, role: "system" },
	{ content: buildFillInputsUserPrompt(input), role: "user" },
];
