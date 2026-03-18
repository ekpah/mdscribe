import type { DocumentType, DocumentTypeConfig } from "@/orpc/scribe/types";
import { withSharedUncertaintyHandling } from "./core/clinical-system-role";
import { ANAMNESE_SYSTEM_PROMPT } from "./families/anamnese";
import { DIAGNOSIS_SYSTEM_PROMPT } from "./families/diagnosis";
import { DISCHARGE_SYSTEM_PROMPT } from "./families/narrative/discharge";
import { ICU_TRANSFER_SYSTEM_PROMPT } from "./families/narrative/icu-transfer";
import { OUTPATIENT_SYSTEM_PROMPT } from "./families/narrative/outpatient";
import { PROCEDURES_SYSTEM_PROMPT } from "./families/procedures";
import { BEFUNDE_SYSTEM_PROMPT } from "./families/reports/befunde";

export const documentPromptDefinitions = {
	anamnese: {
		promptName: "ER_Anamnese_chat",
		systemPrompt: withSharedUncertaintyHandling(ANAMNESE_SYSTEM_PROMPT),
	},
	befunde: {
		promptName: "diagnostic_results",
		systemPrompt: withSharedUncertaintyHandling(BEFUNDE_SYSTEM_PROMPT),
	},
	diagnosis: {
		promptName: "Diagnoses",
		systemPrompt: withSharedUncertaintyHandling(DIAGNOSIS_SYSTEM_PROMPT),
	},
	discharge: {
		promptName: "Inpatient_discharge",
		systemPrompt: withSharedUncertaintyHandling(DISCHARGE_SYSTEM_PROMPT),
	},
	"icu-transfer": {
		promptName: "icu_transfer",
		systemPrompt: withSharedUncertaintyHandling(ICU_TRANSFER_SYSTEM_PROMPT),
	},
	outpatient: {
		promptName: "outpatient_visit",
		systemPrompt: withSharedUncertaintyHandling(OUTPATIENT_SYSTEM_PROMPT),
	},
	procedures: {
		promptName: "procedure",
		systemPrompt: withSharedUncertaintyHandling(PROCEDURES_SYSTEM_PROMPT),
	},
} satisfies Record<DocumentType, DocumentTypeConfig>;
