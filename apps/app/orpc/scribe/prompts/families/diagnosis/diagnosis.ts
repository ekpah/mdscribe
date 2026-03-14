import { DIAGNOSIS_CONTENT_REQUIREMENTS } from "./diagnosis/content-requirements";
import { DIAGNOSIS_EXECUTION_INSTRUCTION } from "./diagnosis/execution-instruction";
import { DIAGNOSIS_FORMATTING_GUIDELINES } from "./diagnosis/formatting-guidelines";
import { DIAGNOSIS_PRIMARY_OBJECTIVE } from "./diagnosis/primary-objective";
import { DIAGNOSIS_QUALITY_CONTROL } from "./diagnosis/quality-control";
import { DIAGNOSIS_SYSTEM_ROLE } from "./diagnosis/system-role";
import { DIAGNOSIS_TASK_EXECUTION } from "./diagnosis/task-execution";
import { DIAGNOSIS_STRUCTURE_RULES } from "./diagnosis/structure-rules";
import { DIAGNOSIS_WORKFLOW } from "./diagnosis/workflow";

const DIAGNOSIS_SYSTEM_PROMPT_PARTS = [
	DIAGNOSIS_SYSTEM_ROLE,
	DIAGNOSIS_PRIMARY_OBJECTIVE,
	DIAGNOSIS_STRUCTURE_RULES,
	DIAGNOSIS_CONTENT_REQUIREMENTS,
	DIAGNOSIS_FORMATTING_GUIDELINES,
	DIAGNOSIS_WORKFLOW,
	DIAGNOSIS_QUALITY_CONTROL,
	DIAGNOSIS_EXECUTION_INSTRUCTION,
];

export const DIAGNOSIS_SYSTEM_PROMPT = DIAGNOSIS_SYSTEM_PROMPT_PARTS.join("\n\n");

export { DIAGNOSIS_TASK_EXECUTION };
