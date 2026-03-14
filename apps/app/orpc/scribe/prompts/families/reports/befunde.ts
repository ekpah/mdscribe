import { BEFUNDE_CONTENT_REQUIREMENTS } from "./befunde/content-requirements";
import { BEFUNDE_EXECUTION_INSTRUCTION } from "./befunde/execution-instruction";
import { BEFUNDE_OUTPUT_STRUCTURE } from "./befunde/output-structure";
import { BEFUNDE_PRIMARY_OBJECTIVE } from "./befunde/primary-objective";
import { BEFUNDE_QUALITY_CONTROL } from "./befunde/quality-control";
import { BEFUNDE_STYLE_GUIDELINES } from "./befunde/style-guidelines";
import { BEFUNDE_SYSTEM_ROLE } from "./befunde/system-role";
import { BEFUNDE_TASK_EXECUTION } from "./befunde/task-execution";

const BEFUNDE_SYSTEM_PROMPT_PARTS = [
	BEFUNDE_SYSTEM_ROLE,
	BEFUNDE_PRIMARY_OBJECTIVE,
	BEFUNDE_CONTENT_REQUIREMENTS,
	BEFUNDE_OUTPUT_STRUCTURE,
	BEFUNDE_STYLE_GUIDELINES,
	BEFUNDE_QUALITY_CONTROL,
	BEFUNDE_EXECUTION_INSTRUCTION,
];

export const BEFUNDE_SYSTEM_PROMPT = BEFUNDE_SYSTEM_PROMPT_PARTS.join("\n\n");

export { BEFUNDE_TASK_EXECUTION };
