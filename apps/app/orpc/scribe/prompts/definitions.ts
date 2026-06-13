import type { DocumentType, DocumentTypeConfig } from "@/orpc/scribe/types";
import { withSharedUncertaintyHandling } from "./core/clinical-system-role";
import { ANAMNESE_SYSTEM_PROMPT } from "./families/anamnese";
import { DIAGNOSIS_SYSTEM_PROMPT } from "./families/diagnosis";
import { EPIKRISE_SYSTEM_PROMPT } from "./families/narrative/epikrise";
import { PROCEDURES_SYSTEM_PROMPT } from "./families/procedures";
import { BEFUNDE_SYSTEM_PROMPT } from "./families/reports/befunde";

export const documentPromptDefinitions = {
	anamnese: {
		promptName: "Anamnese",
		systemPrompt: withSharedUncertaintyHandling(ANAMNESE_SYSTEM_PROMPT),
	},
	befunde: {
		promptName: "Befunde",
		systemPrompt: withSharedUncertaintyHandling(BEFUNDE_SYSTEM_PROMPT),
	},
	diagnosis: {
		promptName: "Diagnoseblock",
		systemPrompt: withSharedUncertaintyHandling(DIAGNOSIS_SYSTEM_PROMPT),
	},
	// The narrative settings share one epikrise prompt; the inpatient,
	// outpatient, and ICU framing lives in their setting templates
	// (context/template/fallback-templates) or a user-selected template.
	discharge: {
		promptName: "Entlassbrief",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	epikrise: {
		promptName: "Epikrise",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	"icu-transfer": {
		promptName: "Verlegungsbrief Intensivstation",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	outpatient: {
		promptName: "Ambulanzkontakt",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	procedures: {
		promptName: "Eingriffsdokumentation",
		systemPrompt: withSharedUncertaintyHandling(PROCEDURES_SYSTEM_PROMPT),
	},
} satisfies Record<DocumentType, DocumentTypeConfig>;
