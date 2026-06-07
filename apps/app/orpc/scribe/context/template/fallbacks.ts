import type { TemplateContextInput } from "@/orpc/scribe/context/types";

import { ANAMNESE_FALLBACK_TEMPLATE } from "./fallback-templates/anamnese";
import { BEFUNDE_FALLBACK_TEMPLATE } from "./fallback-templates/befunde";
import { DIAGNOSIS_FALLBACK_TEMPLATE } from "./fallback-templates/diagnosis";
import { DISCHARGE_FALLBACK_TEMPLATE } from "./fallback-templates/discharge";
import { ICU_TRANSFER_FALLBACK_TEMPLATE } from "./fallback-templates/icu-transfer";
import { OUTPATIENT_FALLBACK_TEMPLATE } from "./fallback-templates/outpatient";
import { PROCEDURES_FALLBACK_TEMPLATE } from "./fallback-templates/procedures";

const FALLBACK_TEMPLATE_BY_CONTEXT_KEY: Record<string, TemplateContextInput> = {
	Diagnoses: DIAGNOSIS_FALLBACK_TEMPLATE,
	ER_Anamnese_chat: ANAMNESE_FALLBACK_TEMPLATE,
	Inpatient_discharge: DISCHARGE_FALLBACK_TEMPLATE,
	anamnese: ANAMNESE_FALLBACK_TEMPLATE,
	befunde: BEFUNDE_FALLBACK_TEMPLATE,
	diagnosis: DIAGNOSIS_FALLBACK_TEMPLATE,
	diagnostic_results: BEFUNDE_FALLBACK_TEMPLATE,
	discharge: DISCHARGE_FALLBACK_TEMPLATE,
	"icu-transfer": ICU_TRANSFER_FALLBACK_TEMPLATE,
	icu_transfer: ICU_TRANSFER_FALLBACK_TEMPLATE,
	outpatient: OUTPATIENT_FALLBACK_TEMPLATE,
	outpatient_visit: OUTPATIENT_FALLBACK_TEMPLATE,
	procedure: PROCEDURES_FALLBACK_TEMPLATE,
	procedures: PROCEDURES_FALLBACK_TEMPLATE,
};

export const resolveFallbackTemplateByContextKey = (
	contextKey?: string,
): TemplateContextInput | undefined => {
	if (!contextKey) {
		return undefined;
	}

	return FALLBACK_TEMPLATE_BY_CONTEXT_KEY[contextKey];
};
