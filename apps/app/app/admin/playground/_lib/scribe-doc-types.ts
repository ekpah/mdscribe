import type { DocumentType } from "@/orpc/scribe/types";

export interface ScribeDocTypeUiField {
	name: string;
	label: string;
	placeholder: string;
	description?: string;
}

export interface ScribeDocTypeUiConfig {
	label: string;
	mainField: ScribeDocTypeUiField;
	additionalFields: ScribeDocTypeUiField[];
	defaultPromptName: string;
}

/**
 * Admin playground UI configs for AI Scribe document types.
 * This intentionally mirrors what the user sees on `/aiscribe/*` pages,
 * but is kept lightweight and admin-focused.
 */
export const scribeDocTypeUi: Record<DocumentType, ScribeDocTypeUiConfig> = {
	"admission-todos": {
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
			{
				label: "Befunde",
				name: "befunde",
				placeholder: "Befunde eingeben...",
			},
		],
		defaultPromptName: "ER_Admission_Todos_chat",
		label: "ER Admission TODOs",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Notizen eingeben...",
		},
	},

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
		defaultPromptName: "ER_Anamnese_chat",
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
		defaultPromptName: "ER_Befunde_chat",
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
		defaultPromptName: "diagnoseblock_update",
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
		defaultPromptName: "Inpatient_discharge_chat",
		label: "Entlassungsbrief",
		mainField: {
			description:
				"Krankheitsverlauf, Behandlung, Empfehlungen. Optional auch bisherigen Brief einfügen.",
			label: "Entlassungsnotizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Entlassungsnotizen ein...",
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
		defaultPromptName: "ICU_transfer_chat",
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
		defaultPromptName: "Outpatient_visit_chat",
		label: "Ambulante Vorstellung",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Notizen ein...",
		},
	},

	"physical-exam": {
		additionalFields: [],
		defaultPromptName: "ER_Koerperliche_Untersuchung_chat",
		label: "ER Körperliche Untersuchung",
		mainField: {
			label: "Notizen",
			name: "notes",
			placeholder: "Untersuchungsbefund eingeben...",
		},
	},

	procedures: {
		additionalFields: [],
		defaultPromptName: "Procedure_chat",
		label: "Prozeduren",
		mainField: {
			label: "Prozedur-Notizen",
			name: "notes",
			placeholder: "Geben Sie hier Ihre Prozedur-Notizen ein...",
		},
	},
};

export const allScribeDocTypes = Object.keys(scribeDocTypeUi) as DocumentType[];

export const isScribeDocType = (value: string): value is DocumentType =>
	value in scribeDocTypeUi;
