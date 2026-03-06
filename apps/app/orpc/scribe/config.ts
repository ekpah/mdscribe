import type {
	AdmissionTodosVariables,
	AnamneseVariables,
	BefundeVariables,
	DiagnosisVariables,
	DischargeVariables,
	DocumentType,
	DocumentTypeConfig,
	IcuTransferVariables,
	OutpatientVariables,
	PhysicalExamVariables,
	ProceduresVariables,
} from "./types";
import {
	diagnosisContextGuidance,
	dischargeContextGuidance,
} from "./context-guidance";
import {
	admissionTodosPromptHarness,
	anamnesePromptHarness,
	befundePromptHarness,
	createPromptMessages,
	diagnosisPromptHarness,
	dischargePromptHarness,
	icuTransferPromptHarness,
	outpatientPromptHarness,
	physicalExamPromptHarness,
	proceduresPromptHarness,
} from "./prompt-harnesses";

/**
 * Configuration for all document types
 * Each configuration defines:
 * - promptName: Legacy reference to Langfuse prompt name
 * - prompt: Function that builds messages from prompt harness + context guidance
 * - modelConfig: AI model settings (thinking mode, tokens, temperature)
 */
export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> = {
	discharge: {
		promptName: "Inpatient_discharge_chat",
		prompt: (vars: DischargeVariables) =>
			createPromptMessages(
				dischargePromptHarness,
				vars,
				dischargeContextGuidance,
			),
		modelConfig: {
			thinking: true,
			thinkingBudget: 12_000,
			maxTokens: 20_000,
			temperature: 0.3,
		},
	},

	anamnese: {
		promptName: "ER_Anamnese_chat",
		prompt: (vars: AnamneseVariables) =>
			createPromptMessages(anamnesePromptHarness, vars),
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	diagnosis: {
		promptName: "diagnoseblock_update",
		prompt: (vars: DiagnosisVariables) =>
			createPromptMessages(
				diagnosisPromptHarness,
				vars,
				diagnosisContextGuidance,
			),
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
	},

	"physical-exam": {
		promptName: "ER_Koerperliche_Untersuchung_chat",
		prompt: (vars: PhysicalExamVariables) =>
			createPromptMessages(physicalExamPromptHarness, vars),
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	procedures: {
		promptName: "Procedure_chat",
		prompt: (vars: ProceduresVariables) =>
			createPromptMessages(proceduresPromptHarness, vars),
		modelConfig: {
			thinking: false,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	"admission-todos": {
		promptName: "ER_Admission_Todos_chat",
		prompt: (vars: AdmissionTodosVariables) =>
			createPromptMessages(admissionTodosPromptHarness, vars),
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	befunde: {
		promptName: "ER_Befunde_chat",
		prompt: (vars: BefundeVariables) =>
			createPromptMessages(befundePromptHarness, vars),
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	outpatient: {
		promptName: "Outpatient_visit_chat",
		prompt: (vars: OutpatientVariables) =>
			createPromptMessages(outpatientPromptHarness, vars),
		modelConfig: {
			thinking: true,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	"icu-transfer": {
		promptName: "ICU_transfer_chat",
		prompt: (vars: IcuTransferVariables) =>
			createPromptMessages(icuTransferPromptHarness, vars),
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
	},
};
