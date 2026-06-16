import type {
	DocumentType,
	DocumentTypeConfig,
	GrammaticalGender,
} from "@/orpc/scribe/types";
import { documentPromptDefinitions } from "./definitions";

export const PROMPT_HARNESS_IDS = [
	"discharge",
	"anamnese",
	"diagnosis",
	"procedures",
	"befunde",
	"epikrise",
	"outpatient",
	"icu-transfer",
] as const satisfies readonly DocumentType[];

export type PromptHarnessId = (typeof PROMPT_HARNESS_IDS)[number];

const legacyPromptHarnessIdsByDocumentType = {
	anamnese: ["ER_Anamnese_chat", "Anamnese"],
	befunde: ["diagnostic_results", "Befunde"],
	diagnosis: ["Diagnoses", "Diagnoseblock", "diagnoseblock_update"],
	discharge: ["Inpatient_discharge", "Entlassbrief"],
	epikrise: ["Epikrise"],
	"icu-transfer": ["icu_transfer", "Verlegungsbrief Intensivstation"],
	outpatient: ["outpatient_visit", "Ambulanzkontakt"],
	procedures: ["procedure", "Befund", "Procedure_chat"],
} as const satisfies Record<PromptHarnessId, readonly string[]>;

// The narrative settings all compose the shared epikrise system prompt; their
// ids remain valid so existing pages/forms keep selecting the matching
// setting template, but new forms should pick `epikrise` plus a template.
const LEGACY_EPIKRISE_HARNESS_IDS = new Set<PromptHarnessId>([
	"discharge",
	"outpatient",
	"icu-transfer",
]);

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

interface PromptHarnessOption {
	id: PromptHarnessId;
	label: string;
}

export const PROMPT_HARNESS_OPTIONS: PromptHarnessOption[] = PROMPT_HARNESS_IDS.map(
	(documentType) => ({
		id: documentType,
		label: documentTypeConfigs[documentType].promptName,
	}),
);

// Options offered when creating/editing AI Vorlagen: the legacy narrative
// ids stay out so new forms use `epikrise` with the setting in the template.
export const SELECTABLE_PROMPT_HARNESS_OPTIONS: PromptHarnessOption[] =
	PROMPT_HARNESS_OPTIONS.filter((option) => !LEGACY_EPIKRISE_HARNESS_IDS.has(option.id));

const isPromptHarnessId = (value: string): value is PromptHarnessId =>
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

// The canonical clinical context field a harness produces/enhances. The main
// input of a form is this field "behind the scenes": context transfer and the
// future note editor pack the field value as the main input and everything
// else as context. Many-to-one (procedures also writes befunde, all narrative
// settings write epikrise), so this cannot collapse into the harness ids.
export type CanonicalContextField = "anamnese" | "befunde" | "diagnoseblock" | "epikrise";

const promptHarnessTargetFields = {
	anamnese: "anamnese",
	befunde: "befunde",
	diagnosis: "diagnoseblock",
	discharge: "epikrise",
	epikrise: "epikrise",
	"icu-transfer": "epikrise",
	outpatient: "epikrise",
	procedures: "befunde",
} as const satisfies Record<PromptHarnessId, CanonicalContextField>;

export const getPromptHarnessTargetField = (
	promptHarness: string | null | undefined,
): CanonicalContextField => {
	const resolved = resolvePromptHarnessId(promptHarness);
	return resolved ? promptHarnessTargetFields[resolved] : "epikrise";
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

export const getPromptHarnessGender = (
	promptHarness: string,
): GrammaticalGender => {
	const documentType = getDocumentTypeByPromptName(promptHarness);
	return documentType ? documentTypeConfigs[documentType].gender : "feminine";
};

export const getPromptHarnessReferences = (documentType: PromptHarnessId): readonly string[] => [
	documentType,
	...legacyPromptHarnessIdsByDocumentType[documentType],
	documentTypeConfigs[documentType].promptName,
];
