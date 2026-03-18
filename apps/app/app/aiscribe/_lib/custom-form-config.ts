import { FileText } from "lucide-react";

import { DEFAULT_AI_TEXT_DESCRIPTION } from "@/lib/ai-scribe-forms";
import type {
	AiscribeTemplateConfig,
	AdditionalInputField,
} from "@/app/aiscribe/_components/aiscribe-template";

export interface PublicAiTextForm {
	description: string | null;
	id: string;
	name: string;
	slug: string;
}

const ADDITIONAL_INPUTS: AdditionalInputField[] = [
	{
		description:
			"Bekannte Vorerkrankungen, chronische Erkrankungen und relevante Diagnosen",
		label: "Diagnoseblock",
		name: "diagnoseblock",
		placeholder: "Diagnoseblock eingeben...",
		type: "textarea",
	},
	{
		description:
			"Aufnahmeanamnese, Beschwerden und weitere relevante Vorgeschichte",
		label: "Anamnese",
		name: "anamnese",
		placeholder: "Anamnese eingeben...",
		type: "textarea",
	},
	{
		description: "Chronologische Befunde, Diagnostik und wichtige Verlaufseinträge",
		label: "Befunde",
		name: "befunde",
		placeholder: "Befunde eingeben...",
		type: "textarea",
	},
];

export const buildCustomAiscribeTemplateConfig = (
	form: PublicAiTextForm,
): AiscribeTemplateConfig => {
	const description = form.description?.trim() || DEFAULT_AI_TEXT_DESCRIPTION;

	return {
		additionalInputs: ADDITIONAL_INPUTS,
		description,
		emptyStateDescription:
			"Bitte geben Sie klinische Informationen ein und starten Sie die Generierung.",
		emptyStateTitle: "Noch keine Ausgabe vorhanden",
		formId: form.id,
		generateButtonText: "Text generieren",
		icon: FileText,
		inputDescription:
			"Dokumentieren Sie die klinisch relevanten Informationen. Weitere Kontextfelder stehen links zur Verfügung.",
		inputFieldName: "notes",
		inputPlaceholder: "Notizen eingeben...",
		inputTabTitle: "Notizen",
		outputTabTitle: "Ausgabe",
		regenerateButtonText: "Neu generieren",
		title: form.name,
	};
};
