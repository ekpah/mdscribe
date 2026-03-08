import type {
	AdmissionTodosVariables,
	AnamneseVariables,
	BefundeVariables,
	DiagnosisVariables,
	DischargeVariables,
	IcuTransferVariables,
	OutpatientVariables,
	PhysicalExamVariables,
	ProceduresVariables,
	PromptMessage,
	PromptVariables,
} from "../types";
import { admissionTodosPromptHarness } from "./admission-todos";
import { anamnesePromptHarness } from "./anamnese";
import { befundePromptHarness } from "./befunde";
import { diagnosisPromptHarness } from "./diagnosis";
import { dischargePromptHarness } from "./discharge";
import { icuTransferPromptHarness } from "./icu-transfer";
import { outpatientPromptHarness } from "./outpatient";
import { physicalExamPromptHarness } from "./physical-exam";
import { proceduresPromptHarness } from "./procedures";
import { createPromptMessages } from "./shared";

interface RegisteredPromptHarness {
	buildPrompt: (variables: PromptVariables) => PromptMessage[];
	id: string;
	label: string;
}

export const promptHarnessRegistry = {
	ER_Admission_Todos_chat: {
		id: "ER_Admission_Todos_chat",
		label: "ER Admission Todos",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(
				admissionTodosPromptHarness,
				variables as AdmissionTodosVariables,
			),
	},
	ER_Anamnese_chat: {
		id: "ER_Anamnese_chat",
		label: "ER Anamnese",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(anamnesePromptHarness, variables as AnamneseVariables),
	},
	ER_Befunde_chat: {
		id: "ER_Befunde_chat",
		label: "ER Befunde",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(befundePromptHarness, variables as BefundeVariables),
	},
	ER_Koerperliche_Untersuchung_chat: {
		id: "ER_Koerperliche_Untersuchung_chat",
		label: "ER Koerperliche Untersuchung",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(
				physicalExamPromptHarness,
				variables as PhysicalExamVariables,
			),
	},
	ICU_transfer_chat: {
		id: "ICU_transfer_chat",
		label: "ICU Transfer",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(
				icuTransferPromptHarness,
				variables as IcuTransferVariables,
			),
	},
	Inpatient_discharge_chat: {
		id: "Inpatient_discharge_chat",
		label: "Inpatient Discharge",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(dischargePromptHarness, variables as DischargeVariables),
	},
	Outpatient_visit_chat: {
		id: "Outpatient_visit_chat",
		label: "Outpatient Visit",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(
				outpatientPromptHarness,
				variables as OutpatientVariables,
			),
	},
	Procedure_chat: {
		id: "Procedure_chat",
		label: "Procedure",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(proceduresPromptHarness, variables as ProceduresVariables),
	},
	diagnoseblock_update: {
		id: "diagnoseblock_update",
		label: "Diagnoseblock Update",
		buildPrompt: (variables: PromptVariables) =>
			createPromptMessages(diagnosisPromptHarness, variables as DiagnosisVariables),
	},
} satisfies Record<string, RegisteredPromptHarness>;

export type PromptHarnessId = keyof typeof promptHarnessRegistry;

export const PROMPT_HARNESS_IDS = Object.keys(
	promptHarnessRegistry,
) as PromptHarnessId[];

export const getPromptHarnessById = (
	id: string,
): RegisteredPromptHarness | undefined => promptHarnessRegistry[id as PromptHarnessId];
