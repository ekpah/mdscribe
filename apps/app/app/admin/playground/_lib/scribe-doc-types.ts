import type { DocumentType } from "@/orpc/scribe/types";

interface ScribeDocTypeUiField {
	name: string;
	label: string;
	placeholder: string;
	description?: string;
}

interface ScribeDocTypeUiConfig {
	label: string;
	mainField: ScribeDocTypeUiField;
	additionalFields: ScribeDocTypeUiField[];
	defaultPromptName: string;
}

export type PlaygroundDocumentType = DocumentType;

/**
 * Admin playground UI configs for AI Scribe document types.
 * This intentionally mirrors what the user sees on `/aiscribe/*` pages,
 * but is kept lightweight and admin-focused.
 */
export const scribeDocTypeUi: Record<PlaygroundDocumentType, ScribeDocTypeUiConfig> = {
	anamnese: {
		additionalFields: [
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
			{
				label: "Vordiagnosen",
				name: "diagnoseblock",
				placeholder: "Vordiagnosen eingeben...",
			},
		],
		defaultPromptName: "anamnese",
		label: "ER Anamnese",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Anamnese-Notizen eingeben...",
		},
	},

	befunde: {
		additionalFields: [
			{
				label: "Anamnese",
				name: "anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				label: "Vordiagnosen",
				name: "diagnoseblock",
				placeholder: "Vordiagnosen eingeben...",
			},
		],
		defaultPromptName: "befunde",
		label: "ER Befunde",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Notizen eingeben...",
		},
	},

	diagnosis: {
		additionalFields: [
			{
				label: "Anamnese",
				name: "anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				label: "Diagnoseblock (alt)",
				name: "diagnoseblock",
				placeholder: "Bestehenden Diagnoseblock eingeben...",
			},
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
		],
		defaultPromptName: "diagnosis",
		label: "Diagnoseblock Update",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Notizen zur Aktualisierung eingeben...",
		},
	},

	discharge: {
		additionalFields: [
			{
				label: "Diagnoseblock",
				name: "diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				label: "Aufnahmeanamnese",
				name: "anamnese",
				placeholder: "Initiale Anamnese bei Aufnahme eingeben...",
			},
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde aus dem stationären Aufenthalt eingeben...",
			},
		],
		defaultPromptName: "discharge",
		label: "Entlassungsbrief",
		mainField: {
			description:
				"Krankheitsverlauf, Behandlung, Empfehlungen. Optional auch bisherigen Brief einfügen.",
			label: "Entlassungsnotizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Entlassungsnotizen ein...",
		},
	},

	epikrise: {
		additionalFields: [
			{
				label: "Diagnoseblock",
				name: "diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				label: "Anamnese",
				name: "anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
		],
		defaultPromptName: "epikrise",
		label: "Epikrise",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Notizen fuer die Epikrise eingeben...",
		},
	},

	"icu-transfer": {
		additionalFields: [
			{
				label: "Anamnese",
				name: "anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				label: "Diagnoseblock",
				name: "diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
		],
		defaultPromptName: "icu-transfer",
		label: "ICU Transfer",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Notizen für Verlegung/Übergabe eingeben...",
		},
	},

	outpatient: {
		additionalFields: [
			{
				label: "Diagnoseblock",
				name: "diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				label: "Anamnese",
				name: "anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
		],
		defaultPromptName: "outpatient",
		label: "Ambulante Vorstellung",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Notizen ein...",
		},
	},

	procedures: {
		additionalFields: [],
		defaultPromptName: "procedures",
		label: "Prozeduren",
		mainField: {
			label: "Prozedur-Notizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Prozedur-Notizen ein...",
		},
	},
};

export const allScribeDocTypes = Object.keys(scribeDocTypeUi) as PlaygroundDocumentType[];

export const isScribeDocType = (value: string): value is PlaygroundDocumentType =>
	value in scribeDocTypeUi;
