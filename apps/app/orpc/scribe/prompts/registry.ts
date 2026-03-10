import { diagnosisContextGuidance, dischargeContextGuidance } from "../context/context-guidance";
import type {
	AdmissionTodosVariables,
	AnamneseVariables,
	BefundeVariables,
	DiagnosisVariables,
	DischargeVariables,
	DocumentType,
	DocumentTypeConfig,
	IcuTransferVariables,
	ModelConfig,
	OutpatientVariables,
	PhysicalExamVariables,
	ProceduresVariables,
	PromptMessage,
	PromptVariables,
} from "../types";
import { admissionTodosPromptHarness } from "./prompt-harnesses/admission-todos";
import { anamnesePromptHarness } from "./prompt-harnesses/anamnese";
import { befundePromptHarness } from "./prompt-harnesses/befunde";
import { diagnosisPromptHarness } from "./prompt-harnesses/diagnosis";
import { dischargePromptHarness } from "./prompt-harnesses/discharge";
import { icuTransferPromptHarness } from "./prompt-harnesses/icu-transfer";
import { outpatientPromptHarness } from "./prompt-harnesses/outpatient";
import { physicalExamPromptHarness } from "./prompt-harnesses/physical-exam";
import { proceduresPromptHarness } from "./prompt-harnesses/procedures";
import { createPromptMessages, type PromptHarness } from "./shared";

export interface RegisteredPromptHarness {
	buildPrompt: (variables: PromptVariables) => PromptMessage[];
	id: PromptHarnessId;
	label: string;
}

interface DocumentPromptDefinition extends DocumentTypeConfig {
	label: string;
}

const createDocumentPromptDefinition = <T extends PromptVariables>(definition: {
	contextGuidance?: string;
	harness: PromptHarness<T>;
	label: string;
	modelConfig: ModelConfig;
	promptName: string;
}): DocumentPromptDefinition => ({
	label: definition.label,
	modelConfig: definition.modelConfig,
	prompt: (variables: PromptVariables) =>
		createPromptMessages(
			definition.harness,
			variables as T,
			definition.contextGuidance,
		),
	promptName: definition.promptName,
});

const documentPromptDefinitions = {
	discharge: createDocumentPromptDefinition<DischargeVariables>({
		contextGuidance: dischargeContextGuidance,
		harness: dischargePromptHarness,
		label: "Inpatient Discharge",
		modelConfig: {
			thinking: true,
			thinkingBudget: 12_000,
			maxTokens: 20_000,
			temperature: 0.3,
		},
		promptName: "Inpatient_discharge_chat",
	}),
	anamnese: createDocumentPromptDefinition<AnamneseVariables>({
		harness: anamnesePromptHarness,
		label: "ER Anamnese",
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "ER_Anamnese_chat",
	}),
	diagnosis: createDocumentPromptDefinition<DiagnosisVariables>({
		contextGuidance: diagnosisContextGuidance,
		harness: diagnosisPromptHarness,
		label: "Diagnoseblock Update",
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
		promptName: "diagnoseblock_update",
	}),
	"physical-exam": createDocumentPromptDefinition<PhysicalExamVariables>({
		harness: physicalExamPromptHarness,
		label: "ER Koerperliche Untersuchung",
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "ER_Koerperliche_Untersuchung_chat",
	}),
	procedures: createDocumentPromptDefinition<ProceduresVariables>({
		harness: proceduresPromptHarness,
		label: "Procedure",
		modelConfig: {
			thinking: false,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "Procedure_chat",
	}),
	"admission-todos": createDocumentPromptDefinition<AdmissionTodosVariables>({
		harness: admissionTodosPromptHarness,
		label: "ER Admission Todos",
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "ER_Admission_Todos_chat",
	}),
	befunde: createDocumentPromptDefinition<BefundeVariables>({
		harness: befundePromptHarness,
		label: "ER Befunde",
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "ER_Befunde_chat",
	}),
	outpatient: createDocumentPromptDefinition<OutpatientVariables>({
		harness: outpatientPromptHarness,
		label: "Outpatient Visit",
		modelConfig: {
			thinking: true,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
		promptName: "Outpatient_visit_chat",
	}),
	"icu-transfer": createDocumentPromptDefinition<IcuTransferVariables>({
		harness: icuTransferPromptHarness,
		label: "ICU Transfer",
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
		promptName: "ICU_transfer_chat",
	}),
} satisfies Record<DocumentType, DocumentPromptDefinition>;

export type PromptHarnessId =
	(typeof documentPromptDefinitions)[keyof typeof documentPromptDefinitions]["promptName"];

type PromptHarnessRegistry = Record<PromptHarnessId, RegisteredPromptHarness>;

const promptHarnessRegistry = Object.values(documentPromptDefinitions).reduce(
	(registry, definition) => {
		const id = definition.promptName as PromptHarnessId;
		registry[id] = {
			buildPrompt: definition.prompt,
			id,
			label: definition.label,
		};
		return registry;
	},
	{} as PromptHarnessRegistry,
);

export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> =
	documentPromptDefinitions;

export const PROMPT_HARNESS_IDS = Object.keys(
	promptHarnessRegistry,
) as PromptHarnessId[];

export const getDocumentTypeConfigByPromptName = (
	promptName: string,
): DocumentTypeConfig | undefined =>
	Object.values(documentTypeConfigs).find(
		(config) => config.promptName === promptName,
	);

export const getPromptHarnessById = (
	id: string,
): RegisteredPromptHarness | undefined =>
	promptHarnessRegistry[id as PromptHarnessId];
