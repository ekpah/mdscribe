import { ClipboardCheck, FileCheck, FileText, Heart, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
	AdditionalInputField,
	AiscribeTemplateConfig,
} from "@/app/aiscribe/_components/aiscribe-template";
import {
	getBuiltInAiscribeOverrideSlug,
	getBuiltInAiscribeOverride,
} from "@/lib/aiscribe-built-ins";
import type { BuiltInAiscribeOverrideKey } from "@/lib/aiscribe-built-ins";
import {
	getPromptHarnessLabel,
	getPromptHarnessTargetField,
	resolvePromptHarnessId,
} from "@/orpc/scribe/prompts";
import type { DocumentType } from "@/orpc/scribe/types";

import { resolveTemplateMetadata } from "./custom-form-config";
import type { PublicAiTextForm } from "./custom-form-config";

interface BuiltInAiscribeTemplateDefinition {
	additionalInputs?: AdditionalInputField[];
	description: string;
	documentType: DocumentType;
	emptyStateDescription: string;
	emptyStateTitle: string;
	generateButtonText: string;
	icon: LucideIcon;
	inputDescription: string;
	inputPlaceholder: string;
	inputTabTitle: string;
	outputTabTitle: string;
	regenerateButtonText: string;
	title: string;
}

const STATIONARY_CONTEXT_ADDITIONAL_INPUTS: AdditionalInputField[] = [
	{
		description:
			"Diagnoseblock des aktuellen Arztbriefes inkl. aktueller Diagnose und Vorerkrankungen (chronische Erkrankungen, Z.n. Operationen etc.)",
		label: "Diagnoseblock",
		name: "diagnoseblock",
		placeholder: "Diagnoseblock eingeben...",
		required: false,
		type: "textarea",
	},
	{
		description: "Anamnese bei Aufnahme inkl. Aufnahmegrund und initiale Verdachtsdiagnose",
		label: "Aufnahmeanamnese",
		name: "anamnese",
		placeholder: "Initiale Anamnese bei Aufnahme eingeben...",
		required: false,
		type: "textarea",
	},
	{
		description:
			"Chronologische Auflistung aller Untersuchungen, Konsile und wichtigen Einträge während des Aufenthalts",
		label: "Befunde",
		name: "befunde",
		placeholder: "Befunde aus dem stationären Aufenthalt eingeben...",
		required: false,
		type: "textarea",
	},
];

const ER_ADDITIONAL_INPUTS: AdditionalInputField[] = [
	{
		description: "Bekannte Vorerkrankungen, chronische Leiden, bisherige Diagnosen",
		label: "Vordiagnosen",
		name: "diagnoseblock",
		placeholder: "Bekannte Vorerkrankungen und Diagnosen eingeben...",
		required: false,
		type: "textarea",
	},
	{
		description:
			"Chronologische Auflistung aller Untersuchungen, Konsile und wichtigen Einträge während der Notaufnahme",
		label: "Befunde",
		name: "befunde",
		placeholder: "Befunde aus der Notaufnahme eingeben...",
		required: false,
		type: "textarea",
	},
];

const PROMPT_HARNESS_ADDITIONAL_INPUTS: Record<string, AdditionalInputField[] | undefined> = {
	anamnese: ER_ADDITIONAL_INPUTS,
	befunde: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
	diagnosis: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
	discharge: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
	epikrise: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
	"icu-transfer": STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
	outpatient: undefined,
	procedures: undefined,
};

const BUILT_IN_AISCRIBE_TEMPLATES = {
	diagnoseblock: {
		additionalInputs: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
		description: "Erstellen Sie aktualisierte Diagnoseblöcke basierend auf bestehenden Diagnosen",
		documentType: "diagnosis",
		emptyStateDescription:
			"Bitte geben Sie zuerst den bestehenden Diagnoseblock ein und generieren Sie einen aktualisierten Diagnoseblock.",
		emptyStateTitle: "Noch kein Diagnoseblock vorhanden",
		generateButtonText: "Diagnoseblock generieren",
		icon: FileText,
		inputDescription:
			"Bestehender Diagnoseblock inkl. aktueller Diagnosen und Vorerkrankungen. Neue Informationen zu Verlauf und Befunden gehören in die Kontextfelder.",
		inputPlaceholder: "Bestehenden Diagnoseblock eingeben...",
		inputTabTitle: "Diagnoseblock",
		outputTabTitle: "Diagnoseblock",
		regenerateButtonText: "Neu generieren",
		title: "Diagnoseblock Update",
	},
	discharge: {
		additionalInputs: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
		description: "Erstellen Sie professionelle Entlassungsbriefe für Ihre Patienten",
		documentType: "discharge",
		emptyStateDescription:
			"Bitte geben Sie zuerst Entlassungsnotizen ein und generieren Sie einen Entlassungsbrief.",
		emptyStateTitle: "Noch kein Entlassungsbrief vorhanden",
		generateButtonText: "Entlassungsbrief generieren",
		icon: FileCheck,
		inputDescription:
			"Dokumentieren Sie den Krankheitsverlauf, die Behandlung und Empfehlungen für die Weiterbehandlung. Fügen Sie hier auch den aktuellen Stand des Entlassungsbriefes ein.",
		inputPlaceholder: "Geben Sie Ihre Entlassungsnotizen ein...",
		inputTabTitle: "Entlassungsnotizen",
		outputTabTitle: "Entlassungsbrief",
		regenerateButtonText: "Neu generieren",
		title: "Entlassungsbrief",
	},
	er: {
		additionalInputs: ER_ADDITIONAL_INPUTS,
		description: "Erstellen Sie professionelle Anamnese-Dokumentation für Notfallpatienten",
		documentType: "anamnese",
		emptyStateDescription:
			"Bitte geben Sie zuerst die Anamnese ein und generieren Sie eine Analyse.",
		emptyStateTitle: "Noch keine Analyse vorhanden",
		generateButtonText: "Analyse generieren",
		icon: Heart,
		inputDescription:
			"Dokumentieren Sie die Symptome, Beschwerden und relevante Vorgeschichte des Patienten",
		inputPlaceholder: "Geben Sie die Anamnese des Patienten ein...",
		inputTabTitle: "Anamnese",
		outputTabTitle: "Analyse",
		regenerateButtonText: "Neu analysieren",
		title: "Notfall Anamnese",
	},
	icu: {
		additionalInputs: STATIONARY_CONTEXT_ADDITIONAL_INPUTS,
		description: "Erstellen Sie professionelle Verlegungsbriefe für Ihre ICU-Patienten",
		documentType: "icu-transfer",
		emptyStateDescription:
			"Bitte geben Sie zuerst Patientennotizen ein und generieren Sie einen Verlegungsbrief.",
		emptyStateTitle: "Noch kein Verlegungsbrief vorhanden",
		generateButtonText: "Verlegungsbrief generieren",
		icon: Stethoscope,
		inputDescription:
			"Dokumentieren Sie den Zustand und die Behandlung des Patienten während des ICU-Aufenthalts",
		inputPlaceholder: "Geben Sie Ihre Notizen zum Patienten ein...",
		inputTabTitle: "Patientennotizen",
		outputTabTitle: "Verlegungsbrief",
		regenerateButtonText: "Neu generieren",
		title: "ICU Verlegungsbrief",
	},
	outpatient: {
		additionalInputs: undefined,
		description: "Erstellen Sie professionelle Arztbriefe für Ihre ambulanten Patienten",
		documentType: "outpatient",
		emptyStateDescription:
			"Bitte geben Sie zuerst Ihre Konsultationsnotizen ein und generieren Sie einen Arztbrief.",
		emptyStateTitle: "Noch kein Arztbrief vorhanden",
		generateButtonText: "Arztbrief generieren",
		icon: Stethoscope,
		inputDescription:
			"Dokumentieren Sie den Verlauf und die Ergebnisse der ambulanten Konsultation",
		inputPlaceholder: "Geben Sie Ihre Notizen zur Konsultation ein...",
		inputTabTitle: "Konsultationsnotizen",
		outputTabTitle: "Arztbrief",
		regenerateButtonText: "Neu generieren",
		title: "Ambulanter Arztbrief",
	},
	procedures: {
		additionalInputs: undefined,
		description:
			"Erstellen Sie professionelle Dokumentationen für medizinische Eingriffe und Prozeduren",
		documentType: "procedures",
		emptyStateDescription:
			"Bitte geben Sie zuerst Eingriffsnotizen ein und generieren Sie eine Dokumentation.",
		emptyStateTitle: "Noch keine Eingriffsdokumentation vorhanden",
		generateButtonText: "Dokumentation generieren",
		icon: ClipboardCheck,
		inputDescription:
			"Dokumentieren Sie den Ablauf, die verwendeten Materialien und Ergebnisse des Eingriffs",
		inputPlaceholder: "Geben Sie Ihre Notizen zum Eingriff ein...",
		inputTabTitle: "Eingriffsnotizen",
		outputTabTitle: "Eingriffsdokumentation",
		regenerateButtonText: "Neu generieren",
		title: "Eingriffsdokumentation",
	},
} as const satisfies Record<BuiltInAiscribeOverrideKey, BuiltInAiscribeTemplateDefinition>;

export type BuiltInAiscribeTemplateKey = BuiltInAiscribeOverrideKey;
export { getBuiltInAiscribeOverrideSlug };

export const buildBuiltInAiscribeTemplateConfig = ({
	overrideForm,
	template,
}: {
	overrideForm?: Pick<PublicAiTextForm, "id" | "promptHarness" | "template"> | null;
	template: BuiltInAiscribeTemplateKey;
}): AiscribeTemplateConfig => {
	const definition = BUILT_IN_AISCRIBE_TEMPLATES[template];
	const { defaultPromptHarness } = getBuiltInAiscribeOverride(template);
	const resolvedPromptHarness = overrideForm?.promptHarness ?? defaultPromptHarness;
	const contextForm: PublicAiTextForm = {
		authorId: null,
		description: null,
		id: overrideForm?.id ?? template,
		name: definition.title,
		promptHarness: resolvedPromptHarness,
		slug: getBuiltInAiscribeOverrideSlug(template),
		template: overrideForm?.template ?? null,
		visibility: "public",
	};
	const resolvedPromptHarnessId =
		resolvePromptHarnessId(resolvedPromptHarness) ?? resolvedPromptHarness;
	// The main input is the harness target field behind the scenes, so no form
	// renders an additional context input for that same field.
	const targetField = getPromptHarnessTargetField(resolvedPromptHarnessId);
	const resolvedAdditionalInputs = (
		overrideForm?.id && overrideForm.promptHarness
			? (PROMPT_HARNESS_ADDITIONAL_INPUTS[resolvedPromptHarnessId] ??
				definition.additionalInputs)
			: definition.additionalInputs
	)?.filter((field) => field.name !== targetField);
	const baseConfig = {
		additionalInputs: resolvedAdditionalInputs,
		contextMetadata: {
			author: "MDScribe-Standard" as const,
			harnessTitle: getPromptHarnessLabel(resolvedPromptHarness),
			template: resolveTemplateMetadata(contextForm),
		},
		description: definition.description,
		emptyStateDescription: definition.emptyStateDescription,
		emptyStateTitle: definition.emptyStateTitle,
		generateButtonText: definition.generateButtonText,
		icon: definition.icon,
		inputDescription: definition.inputDescription,
		inputFieldName: "notes",
		inputPlaceholder: definition.inputPlaceholder,
		inputTabTitle: definition.inputTabTitle,
		outputTabTitle: definition.outputTabTitle,
		promptHarness: resolvedPromptHarnessId,
		regenerateButtonText: definition.regenerateButtonText,
		title: definition.title,
	};

	if (overrideForm?.id) {
		return {
			...baseConfig,
			formId: overrideForm.id,
		};
	}

	return {
		...baseConfig,
		documentType: definition.documentType,
	};
};
