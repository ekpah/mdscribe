import type { DocumentType, DocumentTypeConfig } from "@/orpc/scribe/types";
import { withSharedUncertaintyHandling } from "./core/clinical-core-prompt";
import { ANAMNESE_SYSTEM_PROMPT } from "./families/anamnese";
import { DIAGNOSIS_SYSTEM_PROMPT } from "./families/diagnosis";
import { EPIKRISE_SYSTEM_PROMPT } from "./families/narrative/epikrise";
import { PROCEDURES_SYSTEM_PROMPT } from "./families/procedure";
import { BEFUNDE_SYSTEM_PROMPT } from "./families/reports/befunde";

export const documentPromptDefinitions = {
	anamnese: {
		gender: "feminine",
		promptName: "Anamnese",
		systemPrompt: withSharedUncertaintyHandling(ANAMNESE_SYSTEM_PROMPT),
	},
	befunde: {
		gender: "plural",
		promptName: "Befunde",
		systemPrompt: withSharedUncertaintyHandling(BEFUNDE_SYSTEM_PROMPT),
	},
	diagnosis: {
		gender: "masculine",
		promptName: "Diagnoseblock",
		systemPrompt: withSharedUncertaintyHandling(DIAGNOSIS_SYSTEM_PROMPT),
	},
	// The narrative settings share one epikrise prompt; the inpatient,
	// outpatient, and ICU framing lives in their setting templates
	// (context/template/fallback-templates) or a user-selected template.
	discharge: {
		gender: "masculine",
		promptName: "Entlassbrief",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	epikrise: {
		gender: "feminine",
		promptName: "Epikrise",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	"icu-transfer": {
		gender: "masculine",
		promptName: "Verlegungsbrief Intensivstation",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	outpatient: {
		gender: "masculine",
		promptName: "Ambulanzkontakt",
		systemPrompt: withSharedUncertaintyHandling(EPIKRISE_SYSTEM_PROMPT),
	},
	procedures: {
		gender: "feminine",
		promptName: "Eingriffsdokumentation",
		systemPrompt: withSharedUncertaintyHandling(PROCEDURES_SYSTEM_PROMPT),
	},
} satisfies Record<DocumentType, DocumentTypeConfig>;
