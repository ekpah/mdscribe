import { PROCEDURES_EXECUTION_INSTRUCTION } from "./procedures/execution-instruction";
import { PROCEDURES_INPUT_LABEL } from "./procedures/input-label";
import { PROCEDURES_OUTPUT_STRUCTURE } from "./procedures/output-structure";
import { PROCEDURES_PRIMARY_OBJECTIVE } from "./procedures/primary-objective";
import { PROCEDURES_QUALITY_CONTROL } from "./procedures/quality-control";
import { PROCEDURES_SYSTEM_ROLE } from "./procedures/system-role";

const PROCEDURES_SYSTEM_PROMPT_PARTS = [
	PROCEDURES_SYSTEM_ROLE,
	PROCEDURES_PRIMARY_OBJECTIVE,
	PROCEDURES_OUTPUT_STRUCTURE,
	PROCEDURES_QUALITY_CONTROL,
	"---",
	PROCEDURES_EXECUTION_INSTRUCTION,
];

export const PROCEDURES_SYSTEM_PROMPT = PROCEDURES_SYSTEM_PROMPT_PARTS.join("\n\n");

export { PROCEDURES_INPUT_LABEL };
