import type { DocumentType, DocumentTypeConfig } from "./types";

/**
 * Configuration for all document types
 * Each configuration defines:
 * - promptName: The Langfuse prompt to use
 * - processInput: How to parse the prompt JSON into variables
 * - modelConfig: AI model settings (thinking mode, tokens, temperature)
 */
export const documentTypeConfigs: Record<DocumentType, DocumentTypeConfig> = {
	discharge: {
		promptName: "Inpatient_discharge_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				anamnese,
				diagnoseblock = "Keine Vorerkrankungen",
				dischargeNotes,
				befunde,
			} = parsed;
			return {
				anamnese,
				notes: dischargeNotes,
				diagnoseblock,
				befunde,
			};
		},
		modelConfig: {
			thinking: true,
			thinkingBudget: 12_000,
			maxTokens: 20_000,
			temperature: 0.3,
		},
	},

	anamnese: {
		promptName: "ER_Anamnese_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const { notes, befunde, vordiagnosen = "Keine Vorerkrankungen" } = parsed;
			return { notes, befunde, vordiagnosen };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	diagnosis: {
		promptName: "diagnoseblock_update",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				anamnese,
				diagnoseblock = "Keine Vorerkrankungen",
				notes,
				befunde,
			} = parsed;
			return { anamnese, notes, diagnoseblock, befunde };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
	},

	"physical-exam": {
		promptName: "ER_Koerperliche_Untersuchung_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const { notes } = parsed;
			return { notes };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	procedures: {
		promptName: "Procedure_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const { procedureNotes } = parsed;
			// Note: relevantTemplate will be added by the handler via vector search
			return { notes: procedureNotes };
		},
		modelConfig: {
			thinking: true,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	"admission-todos": {
		promptName: "ER_Admission_Todos_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				notes,
				anamnese = "",
				vordiagnosen = "Keine Vorerkrankungen",
				befunde = "",
			} = parsed;
			return { notes, anamnese, vordiagnosen, befunde };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	befunde: {
		promptName: "ER_Befunde_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				notes,
				anamnese = "",
				vordiagnosen = "Keine Vorerkrankungen",
			} = parsed;
			return { notes, anamnese, vordiagnosen };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	outpatient: {
		promptName: "Outpatient_visit_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				anamnese,
				diagnoseblock = "Keine Vorerkrankungen",
				dischargeNotes,
				befunde,
			} = parsed;
			return {
				anamnese,
				notes: dischargeNotes,
				diagnoseblock,
				befunde,
			};
		},
		modelConfig: {
			thinking: true,
			thinkingBudget: 8000,
			maxTokens: 20_000,
			temperature: 1,
		},
	},

	"icu-transfer": {
		promptName: "ICU_transfer_chat",
		processInput: (prompt: string) => {
			const parsed = JSON.parse(prompt);
			const {
				anamnese,
				diagnoseblock = "Keine Vorerkrankungen",
				notes,
				befunde,
			} = parsed;
			return { anamnese, notes, diagnoseblock, befunde };
		},
		modelConfig: {
			thinking: false,
			maxTokens: 2000,
			temperature: 0.1,
		},
	},
};
