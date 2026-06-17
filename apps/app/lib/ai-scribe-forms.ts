import { BUILT_IN_AISCRIBE_OVERRIDE_SLUGS } from "./aiscribe-built-ins";

const RESERVED_AI_SCRIBE_FORM_SLUGS = [
	"custom",
	"diagnoseblock",
	"discharge",
	"er",
	"icu",
	"outpatient",
	"procedures",
	"u",
	"workspace",
	...BUILT_IN_AISCRIBE_OVERRIDE_SLUGS,
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
