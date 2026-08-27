import { FileText } from "lucide-react";

import type {
	AdditionalInputField,
	AiscribeTemplateConfig,
} from "@/app/aiscribe/_components/aiscribe-template";
import { DEFAULT_AI_TEXT_DESCRIPTION } from "@/lib/ai-scribe-forms";
import { resolveFallbackTemplateByContextKey } from "@/orpc/scribe/context/template/fallbacks";
import {
	getPromptHarnessLabel,
	getPromptHarnessTargetField,
	resolvePromptHarnessId,
} from "@/orpc/scribe/prompts";
import type { CanonicalContextField } from "@/orpc/scribe/prompts";

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
			resolveFallbackTemplateByContextKey(resolvePromptHarnessId(form.promptHarness))?.title ??
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
	{
		description: "Bereits formulierte Epikrise oder zusammenfassender klinischer Verlauf",
		label: "Epikrise",
		name: "epikrise",
		placeholder: "Epikrise eingeben...",
		type: "textarea",
	},
];

// The main input of a custom form IS its harness target field (it is still
// sent as `notes` on the wire), so that field is hidden from the context
// inputs and the main input is labeled after it.
const MAIN_INPUT_UI_BY_TARGET_FIELD: Record<
	CanonicalContextField,
	{ description: string; placeholder: string; tabTitle: string }
> = {
	anamnese: {
		description:
			"Dokumentieren Sie Anamnese, Beschwerden und relevante Vorgeschichte. Weitere Kontextfelder stehen links zur Verfügung.",
		placeholder: "Anamnese eingeben...",
		tabTitle: "Anamnese",
	},
	befunde: {
		description:
			"Dokumentieren Sie Befunde, Diagnostik und Verlaufseinträge. Weitere Kontextfelder stehen links zur Verfügung.",
		placeholder: "Befunde eingeben...",
		tabTitle: "Befunde",
	},
	diagnoseblock: {
		description:
			"Dokumentieren Sie bestehende Diagnosen und neue Erkenntnisse. Weitere Kontextfelder stehen links zur Verfügung.",
		placeholder: "Diagnoseblock eingeben...",
		tabTitle: "Diagnoseblock",
	},
	epikrise: {
		description:
			"Dokumentieren Sie Notizen oder eine bisherige Epikrise als Grundlage. Weitere Kontextfelder stehen links zur Verfügung.",
		placeholder: "Notizen oder Epikrise eingeben...",
		tabTitle: "Epikrise",
	},
};

export const buildCustomAiscribeTemplateConfig = (
	form: PublicAiTextForm,
): AiscribeTemplateConfig => {
	const description = form.description?.trim() || DEFAULT_AI_TEXT_DESCRIPTION;
	const authorName = form.author?.name?.trim();
	const targetField = getPromptHarnessTargetField(form.promptHarness);
	const mainInputUi = MAIN_INPUT_UI_BY_TARGET_FIELD[targetField];

	return {
		additionalInputs: ADDITIONAL_INPUTS.filter((field) => field.name !== targetField),
		contextMetadata: {
			author: form.authorId ? authorName || "Nutzer-Textbaustein" : "MDScribe-Standard",
			harnessTitle: getPromptHarnessLabel(form.promptHarness),
			template: resolveTemplateMetadata(form),
		},
		description,
		emptyStateDescription:
			"Bitte geben Sie klinische Informationen ein und starten Sie die Generierung.",
		emptyStateTitle: "Noch keine Ausgabe vorhanden",
		formId: form.id,
		generateButtonText: "Text generieren",
		icon: FileText,
		inputDescription: mainInputUi.description,
		inputFieldName: "notes",
		inputPlaceholder: mainInputUi.placeholder,
		inputTabTitle: mainInputUi.tabTitle,
		outputTabTitle: "Ausgabe",
		promptHarness: resolvePromptHarnessId(form.promptHarness) ?? form.promptHarness,
		regenerateButtonText: "Neu generieren",
		title: form.name,
	};
};
