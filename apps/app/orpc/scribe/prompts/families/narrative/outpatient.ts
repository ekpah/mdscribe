import { OUTPATIENT_CONTENT_REQUIREMENTS } from "./outpatient/content-requirements";
import { OUTPATIENT_GOAL } from "./outpatient/goal";
import { OUTPATIENT_INPUT_LABEL } from "./outpatient/input-label";
import { OUTPATIENT_INTRO } from "./outpatient/intro";
import { OUTPATIENT_OUTPUT_STRUCTURE } from "./outpatient/output-structure";
import { OUTPATIENT_STYLE_ORIENTATION } from "./outpatient/style-orientation";

const OUTPATIENT_SYSTEM_PROMPT_PARTS = [
	OUTPATIENT_INTRO,
	OUTPATIENT_GOAL,
	OUTPATIENT_CONTENT_REQUIREMENTS,
	OUTPATIENT_STYLE_ORIENTATION,
	OUTPATIENT_OUTPUT_STRUCTURE,
	OUTPATIENT_INPUT_LABEL,
];

export const OUTPATIENT_SYSTEM_PROMPT = OUTPATIENT_SYSTEM_PROMPT_PARTS.join("\n\n");
