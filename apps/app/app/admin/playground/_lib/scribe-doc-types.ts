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
	discharge: {
		label: "Entlassungsbrief",
		defaultPromptName: "Inpatient_discharge_chat",
		mainField: {
			name: "dischargeNotes",
			label: "Entlassungsnotizen",
			placeholder: "Geben Sie hier Ihre Entlassungsnotizen ein...",
			description:
				"Krankheitsverlauf, Behandlung, Empfehlungen. Optional auch bisherigen Brief einfügen.",
		},
		additionalFields: [
			{
				name: "diagnoseblock",
				label: "Diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				name: "anamnese",
				label: "Aufnahmeanamnese",
				placeholder: "Initiale Anamnese bei Aufnahme eingeben...",
			},
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde aus dem stationären Aufenthalt eingeben...",
			},
		],
	},

	outpatient: {
		label: "Ambulante Vorstellung",
		defaultPromptName: "Outpatient_visit_chat",
		mainField: {
			name: "dischargeNotes",
			label: "Notizen",
			placeholder: "Geben Sie hier Ihre Notizen ein...",
		},
		additionalFields: [
			{
				name: "diagnoseblock",
				label: "Diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				name: "anamnese",
				label: "Anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde eingeben...",
			},
		],
	},

	procedures: {
		label: "Prozeduren",
		defaultPromptName: "Procedure_chat",
		mainField: {
			name: "procedureNotes",
			label: "Prozedur-Notizen",
			placeholder: "Geben Sie hier Ihre Prozedur-Notizen ein...",
		},
		additionalFields: [],
	},

	anamnese: {
		label: "ER Anamnese",
		defaultPromptName: "ER_Anamnese_chat",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Anamnese-Notizen eingeben...",
		},
		additionalFields: [
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde eingeben...",
			},
			{
				name: "vordiagnosen",
				label: "Vordiagnosen",
				placeholder: "Vordiagnosen eingeben...",
			},
		],
	},

	"physical-exam": {
		label: "ER Körperliche Untersuchung",
		defaultPromptName: "ER_Koerperliche_Untersuchung_chat",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Untersuchungsbefund eingeben...",
		},
		additionalFields: [],
	},

	diagnosis: {
		label: "Diagnoseblock Update",
		defaultPromptName: "diagnoseblock_update",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Notizen zur Aktualisierung eingeben...",
		},
		additionalFields: [
			{
				name: "anamnese",
				label: "Anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				name: "diagnoseblock",
				label: "Diagnoseblock (alt)",
				placeholder: "Bestehenden Diagnoseblock eingeben...",
			},
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde eingeben...",
			},
		],
	},

	"admission-todos": {
		label: "ER Admission TODOs",
		defaultPromptName: "ER_Admission_Todos_chat",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Notizen eingeben...",
		},
		additionalFields: [
			{
				name: "anamnese",
				label: "Anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				name: "vordiagnosen",
				label: "Vordiagnosen",
				placeholder: "Vordiagnosen eingeben...",
			},
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde eingeben...",
			},
		],
	},

	befunde: {
		label: "ER Befunde",
		defaultPromptName: "ER_Befunde_chat",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Notizen eingeben...",
		},
		additionalFields: [
			{
				name: "anamnese",
				label: "Anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				name: "vordiagnosen",
				label: "Vordiagnosen",
				placeholder: "Vordiagnosen eingeben...",
			},
		],
	},

	"icu-transfer": {
		label: "ICU Transfer",
		defaultPromptName: "ICU_transfer_chat",
		mainField: {
			name: "notes",
			label: "Notizen",
			placeholder: "Notizen für Verlegung/Übergabe eingeben...",
		},
		additionalFields: [
			{
				name: "anamnese",
				label: "Anamnese",
				placeholder: "Anamnese eingeben...",
			},
			{
				name: "diagnoseblock",
				label: "Diagnoseblock",
				placeholder: "Diagnoseblock eingeben...",
			},
			{
				name: "befunde",
				label: "Befunde",
				placeholder: "Befunde eingeben...",
			},
		],
	},
};

export const allScribeDocTypes = Object.keys(scribeDocTypeUi) as DocumentType[];

