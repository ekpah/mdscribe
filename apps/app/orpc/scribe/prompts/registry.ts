import type {
	DocumentType,
	DocumentTypeConfig,
} from "@/orpc/scribe/types";
import { documentPromptDefinitions } from "./definitions";

export const PROMPT_HARNESS_IDS = [
	"discharge",
	"anamnese",
	"diagnosis",
	"procedures",
	"befunde",
	"outpatient",
	"icu-transfer",
] as const satisfies readonly DocumentType[];

export type PromptHarnessId = (typeof PROMPT_HARNESS_IDS)[number];

const legacyPromptHarnessIdsByDocumentType = {
	anamnese: ["ER_Anamnese_chat", "Anamnese"],
	befunde: ["diagnostic_results", "Befunde"],
	diagnosis: ["Diagnoses", "Diagnoseblock"],
	discharge: ["Inpatient_discharge", "Entlassbrief"],
	"icu-transfer": ["icu_transfer", "Verlegungsbrief Intensivstation"],
	outpatient: ["outpatient_visit", "Ambulanzkontakt"],
	procedures: ["procedure", "Befund"],
} as const satisfies Record<PromptHarnessId, readonly string[]>;

const promptHarnessIdSet = new Set<string>(PROMPT_HARNESS_IDS);

const promptHarnessAliasMap = new Map<string, PromptHarnessId>(
	PROMPT_HARNESS_IDS.flatMap((documentType) =>
		legacyPromptHarnessIdsByDocumentType[documentType].map(
			(alias) => [alias, documentType] as const,
		),
	),
);

export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> =
	documentPromptDefinitions;

export interface PromptHarnessOption {
	id: PromptHarnessId;
	label: string;
}

export const PROMPT_HARNESS_OPTIONS: PromptHarnessOption[] = PROMPT_HARNESS_IDS.map(
	(documentType) => ({
		id: documentType,
		label: documentTypeConfigs[documentType].promptName,
	}),
);

export const isPromptHarnessId = (value: string): value is PromptHarnessId =>
	promptHarnessIdSet.has(value);

export const resolvePromptHarnessId = (
	value: string | null | undefined,
): PromptHarnessId | undefined => {
	const trimmed = value?.trim();
	if (!trimmed) {
		return undefined;
	}

	if (isPromptHarnessId(trimmed)) {
		return trimmed;
	}

	return promptHarnessAliasMap.get(trimmed);
};

export const getDocumentTypeByPromptName = (
	promptName: string,
): DocumentType | undefined => {
	const resolvedHarnessId = resolvePromptHarnessId(promptName);
	if (resolvedHarnessId) {
		return resolvedHarnessId;
	}

	const entry = PROMPT_HARNESS_IDS.find(
		(documentType) => documentTypeConfigs[documentType].promptName === promptName,
	);
	return entry;
};

export const getPromptHarnessLabel = (promptHarness: string): string => {
	const documentType = getDocumentTypeByPromptName(promptHarness);
	return documentType ? documentTypeConfigs[documentType].promptName : promptHarness;
};

export const getPromptHarnessOption = (
	promptHarness: string,
): PromptHarnessOption | undefined => {
	const documentType = getDocumentTypeByPromptName(promptHarness);
	if (!documentType) {
		return undefined;
	}

	return {
		id: documentType,
		label: documentTypeConfigs[documentType].promptName,
	};
};

export const getPromptHarnessReferences = (documentType: PromptHarnessId): readonly string[] => [
	documentType,
	...legacyPromptHarnessIdsByDocumentType[documentType],
	documentTypeConfigs[documentType].promptName,
];
