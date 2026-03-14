import { ICU_TRANSFER_CONTENT_REQUIREMENTS } from "./icu-transfer/content-requirements";
import { ICU_TRANSFER_OUTPUT_EXAMPLE } from "./icu-transfer/output-example";
import { ICU_TRANSFER_OUTPUT_STRUCTURE } from "./icu-transfer/output-structure";
import { ICU_TRANSFER_QUALITY_CONTROL } from "./icu-transfer/quality-control";
import { ICU_TRANSFER_STYLE_GUIDELINES } from "./icu-transfer/style-guidelines";
import { ICU_TRANSFER_WORKFLOW } from "./icu-transfer/workflow";
import { NARRATIVE_PRIMARY_OBJECTIVE } from "./shared/primary-objective";
import { NARRATIVE_SYSTEM_ROLE } from "./shared/system-role";

const ICU_TRANSFER_SYSTEM_PROMPT_PARTS = [
	NARRATIVE_SYSTEM_ROLE,
	NARRATIVE_PRIMARY_OBJECTIVE,
	ICU_TRANSFER_CONTENT_REQUIREMENTS,
	ICU_TRANSFER_STYLE_GUIDELINES,
	ICU_TRANSFER_WORKFLOW,
	ICU_TRANSFER_QUALITY_CONTROL,
];

const ICU_TRANSFER_OUTPUT_PROMPT_PARTS = [
	ICU_TRANSFER_OUTPUT_STRUCTURE,
	ICU_TRANSFER_OUTPUT_EXAMPLE,
];

export const ICU_TRANSFER_SYSTEM_PROMPT = ICU_TRANSFER_SYSTEM_PROMPT_PARTS.join("\n\n");

export const ICU_TRANSFER_OUTPUT_PROMPT = ICU_TRANSFER_OUTPUT_PROMPT_PARTS.join("\n\n");
