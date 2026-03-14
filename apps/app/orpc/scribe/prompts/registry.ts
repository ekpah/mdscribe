import { DIAGNOSIS_CONTEXT_GUIDANCE } from "@/orpc/scribe/context/patient/guidance";
import type {
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
} from "@/orpc/scribe/types";
import { ANAMNESE_SYSTEM_PROMPT } from "./families/anamnese/anamnese";
import { DIAGNOSIS_SYSTEM_PROMPT, DIAGNOSIS_TASK_EXECUTION } from "./families/diagnosis/diagnosis";
import { DISCHARGE_SYSTEM_PROMPT, DISCHARGE_TASK_EXECUTION } from "./families/narrative/discharge";
import {
	ICU_TRANSFER_OUTPUT_PROMPT,
	ICU_TRANSFER_SYSTEM_PROMPT,
} from "./families/narrative/icu-transfer";
import { OUTPATIENT_SYSTEM_PROMPT } from "./families/narrative/outpatient";
import { PROCEDURES_INPUT_LABEL, PROCEDURES_SYSTEM_PROMPT } from "./families/procedures/procedures";
import { BEFUNDE_SYSTEM_PROMPT, BEFUNDE_TASK_EXECUTION } from "./families/reports/befunde";
import { PHYSICAL_EXAM_SYSTEM_PROMPT } from "./families/reports/physical-exam";
import { createPromptMessages } from './shared';
import type { PromptPart } from './shared';

const ANAMNESE_FALLBACK_TEMPLATE = `
# Anamnese

{% switch "Geschlecht" %}{% case "Männlich" %}Herr{% /case %}{% case "Weiblich" %}Frau{% /case %}{% /switch %}{% info "Name" /%} stellt sich bei XXX in unserer Notaufnahme vor.

Allergien: Keine bekannt. ((hier Allergien aus Vorbefunden oder was der Patient erwähnt einfügen))

Vormedikation: Keine. ((Hier nur Wirkstoffnamen nennen, außer genaueres ist bekannt. Wenn ganz genaues bekannt ist, dann in einzelnen Zeilen und mit Dosierung aufführen))

Vitalparameter:

Puls 60/min, RR 180/20 mmHg, SpO2 99%, AF 15/min, Blutzucker 120 mg/dl

`

interface RegisteredPromptHarness {
	buildPrompt: (variables: PromptVariables) => PromptMessage[];
	id: PromptHarnessId;
	label: string;
}

interface DocumentPromptDefinition extends DocumentTypeConfig {
	label: string;
}

const createDocumentPromptDefinition = <T extends PromptVariables>(definition: {
	harness: PromptHarness<T>;
	label: string;
	modelConfig: ModelConfig;
	promptName: string;
}): DocumentPromptDefinition => ({
	label: definition.label,
	modelConfig: definition.modelConfig,
	prompt: (variables: PromptVariables) => createPromptMessages(definition.harness, variables as T),
	promptName: definition.promptName,
});

interface PromptHarness<T> {
	systemParts: PromptPart<T>[];
	userParts: PromptPart<T>[];
}

const buildDateLine = <T extends PromptVariables>(vars: T): string =>
	`Das heutige Datum ist der ${vars.todaysDate}.`;

const documentPromptDefinitions = {
	anamnese: createDocumentPromptDefinition<AnamneseVariables>({
		harness: {
			systemParts: [ANAMNESE_SYSTEM_PROMPT],
			userParts: [ANAMNESE_FALLBACK_TEMPLATE, (vars) => vars.contextXml],
		},
			label: "ER Anamnese",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 1,
				thinking: false,
			},
		promptName: "ER_Anamnese_chat",
	}),
	befunde: createDocumentPromptDefinition<BefundeVariables>({
		harness: {
			systemParts: [BEFUNDE_SYSTEM_PROMPT],
			userParts: [buildDateLine, (vars) => vars.contextXml, BEFUNDE_TASK_EXECUTION],
		},
			label: "diagnostic_results",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 1,
				thinking: false,
			},
		promptName: "diagnostic_results",
	}),
	diagnosis: createDocumentPromptDefinition<DiagnosisVariables>({
		harness: {
			systemParts: [DIAGNOSIS_SYSTEM_PROMPT, DIAGNOSIS_CONTEXT_GUIDANCE],
			userParts: [buildDateLine, (vars) => vars.contextXml, DIAGNOSIS_TASK_EXECUTION],
		},
			label: "Diagnoses",
			modelConfig: {
				maxTokens: 2000,
				temperature: 0.1,
				thinking: false,
			},
		promptName: "Diagnoses",
	}),
	discharge: createDocumentPromptDefinition<DischargeVariables>({
		harness: {
			systemParts: [DISCHARGE_SYSTEM_PROMPT],
			userParts: [buildDateLine, (vars) => vars.contextXml, DISCHARGE_TASK_EXECUTION],
		},
			label: "Inpatient_discharge",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 0.3,
				thinking: true,
				thinkingBudget: 12_000,
			},
		promptName: "Inpatient_discharge",
	}),
	"icu-transfer": createDocumentPromptDefinition<IcuTransferVariables>({
		harness: {
			systemParts: [ICU_TRANSFER_SYSTEM_PROMPT],
			userParts: [ICU_TRANSFER_OUTPUT_PROMPT, buildDateLine, (vars) => vars.contextXml],
		},
			label: "icu_transfer",
			modelConfig: {
				maxTokens: 2000,
				temperature: 0.1,
				thinking: false,
			},
		promptName: "icu_transfer",
	}),
	outpatient: createDocumentPromptDefinition<OutpatientVariables>({
		harness: {
			systemParts: [OUTPATIENT_SYSTEM_PROMPT],
			userParts: [(vars) => vars.contextXml],
		},
			label: "outpatient_visit",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 1,
				thinking: true,
				thinkingBudget: 8000,
			},
		promptName: "outpatient_visit",
	}),
	"physical-exam": createDocumentPromptDefinition<PhysicalExamVariables>({
		harness: {
			systemParts: [PHYSICAL_EXAM_SYSTEM_PROMPT],
			userParts: [buildDateLine, (vars) => vars.contextXml],
		},
			label: "physical_exam",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 1,
				thinking: false,
			},
		promptName: "physical_exam",
	}),
	procedures: createDocumentPromptDefinition<ProceduresVariables>({
		harness: {
			systemParts: [PROCEDURES_SYSTEM_PROMPT],
			userParts: [
				(vars) => vars.relevantTemplate,
				PROCEDURES_INPUT_LABEL,
				(vars) => vars.contextXml,
			],
		},
			label: "procedure",
			modelConfig: {
				maxTokens: 20_000,
				temperature: 1,
				thinking: false,
				thinkingBudget: 8000,
			},
		promptName: "procedure",
	}),
} satisfies Record<DocumentType, DocumentPromptDefinition>;

const exposedPromptHarnessDocumentTypes = [
	"discharge",
	"anamnese",
	"diagnosis",
	"physical-exam",
	"procedures",
	"befunde",
	"outpatient",
	"icu-transfer",
] as const satisfies DocumentType[];

export type PromptHarnessId =
	(typeof documentPromptDefinitions)[(typeof exposedPromptHarnessDocumentTypes)[number]]["promptName"];

type PromptHarnessRegistry = Record<PromptHarnessId, RegisteredPromptHarness>;

const promptHarnessRegistry: PromptHarnessRegistry = {};
for (const documentType of exposedPromptHarnessDocumentTypes) {
	const definition = documentPromptDefinitions[documentType];
	const id = definition.promptName as PromptHarnessId;
	promptHarnessRegistry[id] = {
		buildPrompt: definition.prompt,
		id,
		label: definition.label,
	};
}

export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> =
	documentPromptDefinitions;

export const PROMPT_HARNESS_IDS = Object.keys(promptHarnessRegistry) as PromptHarnessId[];

export const getDocumentTypeConfigByPromptName = (
	promptName: string,
): DocumentTypeConfig | undefined =>
	Object.values(documentTypeConfigs).find((config) => config.promptName === promptName);

export const getPromptHarnessById = (id: string): RegisteredPromptHarness | undefined =>
	promptHarnessRegistry[id as PromptHarnessId];
