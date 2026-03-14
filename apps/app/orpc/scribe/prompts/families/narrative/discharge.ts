import { NARRATIVE_CONTENT_REQUIREMENTS } from "@/orpc/scribe/prompts/core/content-requirements";
import { NARRATIVE_OUTPUT_STRUCTURE } from "./discharge/output-structure";
import { NARRATIVE_EXECUTION_INSTRUCTION } from "./shared/execution-instruction";
import { NARRATIVE_PRIMARY_OBJECTIVE } from "./shared/primary-objective";
import { NARRATIVE_QUALITY_CONTROL } from "./shared/quality-control";
import { NARRATIVE_STYLE_GUIDELINES } from "./shared/style-guidelines";
import { NARRATIVE_SYSTEM_ROLE } from "./shared/system-role";
import { NARRATIVE_WORKFLOW } from "./shared/workflow";

const DISCHARGE_SYSTEM_PROMPT_PARTS = [
	NARRATIVE_SYSTEM_ROLE,
	NARRATIVE_PRIMARY_OBJECTIVE,
	NARRATIVE_CONTENT_REQUIREMENTS,
	NARRATIVE_OUTPUT_STRUCTURE,
	NARRATIVE_STYLE_GUIDELINES,
	NARRATIVE_WORKFLOW,
	NARRATIVE_QUALITY_CONTROL,
	NARRATIVE_EXECUTION_INSTRUCTION,
];

export const DISCHARGE_SYSTEM_PROMPT = DISCHARGE_SYSTEM_PROMPT_PARTS.join("\n\n");

export const DISCHARGE_TASK_EXECUTION = `<task_execution>
Erstellen Sie basierend auf den obigen Patientendaten eine Epikrise und ein Procedere gemäß den System-Anweisungen. Ausgabe nur: Epikrise (Fließtext) und Procedere (Stichpunkte).
</task_execution>`;
