export const AI_SCRIBE_INPUT_PRESETS = [
	"notesOnly",
	"notesWithDiagnoseblock",
	"fullClinicalContext",
	"procedures",
] as const;

export type AiScribeInputPreset = (typeof AI_SCRIBE_INPUT_PRESETS)[number];

export const RESERVED_AI_SCRIBE_FORM_SLUGS = [
	"custom",
	"diagnoseblock",
	"discharge",
	"editor",
	"er",
	"icu",
	"outpatient",
	"procedures",
] as const;

export const AI_SCRIBE_FORM_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DEFAULT_AI_TEXT_DESCRIPTION =
	"Generiert strukturierte Texte auf Basis von Notizen, Diagnosen, Anamnese und Befunden.";

export const isReservedAiScribeFormSlug = (slug: string): boolean =>
	RESERVED_AI_SCRIBE_FORM_SLUGS.includes(
		slug as (typeof RESERVED_AI_SCRIBE_FORM_SLUGS)[number],
	);

export const slugifyAiScribeFormName = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-+|-+$/g, "")
		.replaceAll(/-{2,}/g, "-");
