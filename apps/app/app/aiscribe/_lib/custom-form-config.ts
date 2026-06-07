import { FileText } from "lucide-react";

import type {
	AdditionalInputField,
	AiscribeTemplateConfig,
} from "@/app/aiscribe/_components/aiscribe-template";
import { DEFAULT_AI_TEXT_DESCRIPTION } from "@/lib/ai-scribe-forms";
import { resolvePromptHarnessId } from "@/orpc/scribe/prompts";

export interface PublicAiTextForm {
	author?: {
		id: string;
		name: string | null;
	} | null;
	authorId: string | null;
	description: string | null;
	id: string;
	name: string;
	promptHarness: string;
	slug: string;
	template?: {
		id: string;
		title: string;
	} | null;
	visibility: "public" | "private";
}

const PROMPT_HARNESS_TITLES: Record<string, string> = {
	anamnese: "Anamnese",
	befunde: "Befunde",
	diagnosis: "Diagnoseblock",
	discharge: "Entlassungsbrief",
	"icu-transfer": "ICU Verlegungsbrief",
	outpatient: "Ambulanter Arztbrief",
	procedures: "Eingriffsdokumentation",
};

const FALLBACK_TEMPLATE_TITLES_BY_PROMPT_HARNESS: Record<string, string> = {
	anamnese: "Standardstruktur Anamnese",
	befunde: "Standardstruktur Befunde",
	diagnosis: "Standardstruktur Diagnoseblock",
	discharge: "Standardstruktur Entlassbrief",
	"icu-transfer": "Standardstruktur ICU-Verlegung",
	outpatient: "Standardstruktur Ambulanzbrief",
	procedures: "Standardstruktur Prozedurdokumentation",
};

export const resolvePromptHarnessTitle = (promptHarness: string): string =>
	PROMPT_HARNESS_TITLES[resolvePromptHarnessId(promptHarness) ?? promptHarness] ?? promptHarness;

export const resolveTemplateMetadata = (
	form: PublicAiTextForm,
): AiscribeTemplateConfig["contextMetadata"]["template"] => {
	if (form.template) {
		return {
			href: `/templates/${form.template.id}`,
			title: form.template.title,
		};
	}

	return {
		title:
			FALLBACK_TEMPLATE_TITLES_BY_PROMPT_HARNESS[
				resolvePromptHarnessId(form.promptHarness) ?? form.promptHarness
			] ??
			"Eingebaute Standardvorlage",
	};
};

const ADDITIONAL_INPUTS: AdditionalInputField[] = [
	{
		description: "Bekannte Vorerkrankungen, chronische Erkrankungen und relevante Diagnosen",
		label: "Diagnoseblock",
		name: "diagnoseblock",
		placeholder: "Diagnoseblock eingeben...",
		type: "textarea",
	},
	{
		description: "Aufnahmeanamnese, Beschwerden und weitere relevante Vorgeschichte",
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
	const authorName = form.author?.name?.trim();

	return {
		additionalInputs: ADDITIONAL_INPUTS,
		contextMetadata: {
			author: form.authorId ? (authorName || "Nutzer-Textbaustein") : "MDScribe-Standard",
			harnessTitle: resolvePromptHarnessTitle(form.promptHarness),
			template: resolveTemplateMetadata(form),
		},
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
