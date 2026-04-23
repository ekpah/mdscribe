import type { PromptHarnessId } from "@/orpc/scribe/prompts";

interface BuiltInAiscribeOverrideDefinition {
	defaultPromptHarness: PromptHarnessId;
	description: string;
	path: `/aiscribe/${string}`;
	slug: string;
	title: string;
}

export const BUILT_IN_AISCRIBE_OVERRIDE_KEYS = [
	"er",
	"icu",
	"outpatient",
	"procedures",
	"discharge",
	"diagnoseblock",
] as const;

export type BuiltInAiscribeOverrideKey =
	(typeof BUILT_IN_AISCRIBE_OVERRIDE_KEYS)[number];

const BUILT_IN_AISCRIBE_OVERRIDES: Record<
	BuiltInAiscribeOverrideKey,
	BuiltInAiscribeOverrideDefinition
> = {
	diagnoseblock: {
		defaultPromptHarness: "Diagnoses",
		description:
			"Aktualisierte Diagnoseblöcke basierend auf bestehenden Diagnosen erstellen.",
		path: "/aiscribe/diagnoseblock",
		slug: "builtin-diagnoseblock",
		title: "Diagnoseblock Update",
	},
	discharge: {
		defaultPromptHarness: "Inpatient_discharge",
		description:
			"AI Scribe für Entlassungsbriefe. Strukturierte Entlassungsdokumentation erstellen.",
		path: "/aiscribe/discharge",
		slug: "builtin-discharge",
		title: "Entlassung Modus",
	},
	er: {
		defaultPromptHarness: "ER_Anamnese_chat",
		description:
			"AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen, Differenzialdiagnosen und Dispositionen.",
		path: "/aiscribe/er",
		slug: "builtin-er",
		title: "ER Modus",
	},
	icu: {
		defaultPromptHarness: "icu_transfer",
		description:
			"AI Scribe für Intensivstation-Szenarien. Generiere Anamnesen, Differenzialdiagnosen und Dispositionen.",
		path: "/aiscribe/icu",
		slug: "builtin-icu",
		title: "ICU Modus",
	},
	outpatient: {
		defaultPromptHarness: "outpatient_visit",
		description:
			"AI Scribe für ambulante Konsultationen. Generiere professionelle Arztbriefe für ambulante Patienten.",
		path: "/aiscribe/outpatient",
		slug: "builtin-outpatient",
		title: "Ambulanter Modus",
	},
	procedures: {
		defaultPromptHarness: "procedure",
		description:
			"AI Scribe für Prozeduren. Dokumentation für medizinische Eingriffe generieren.",
		path: "/aiscribe/procedures",
		slug: "builtin-procedures",
		title: "Prozeduren Modus",
	},
};

export const BUILT_IN_AISCRIBE_OVERRIDE_SLUGS =
	BUILT_IN_AISCRIBE_OVERRIDE_KEYS.map(
		(key) => BUILT_IN_AISCRIBE_OVERRIDES[key].slug,
	);

export const getBuiltInAiscribeOverride = (
	key: BuiltInAiscribeOverrideKey,
): BuiltInAiscribeOverrideDefinition => BUILT_IN_AISCRIBE_OVERRIDES[key];

export const getBuiltInAiscribeOverrideSlug = (
	key: BuiltInAiscribeOverrideKey,
): string => BUILT_IN_AISCRIBE_OVERRIDES[key].slug;

export const isBuiltInAiscribeOverrideSlug = (slug: string): boolean =>
	BUILT_IN_AISCRIBE_OVERRIDE_SLUGS.includes(slug);
