export const AI_SCRIBE_GENERATION_EVENT_NAME = "ai_scribe_generation";
export const AI_INPUT_FILL_EVENT_NAME = "ai_input_fill";

export const BILLABLE_SCRIBE_USAGE_EVENT_NAMES = [
	AI_SCRIBE_GENERATION_EVENT_NAME,
	AI_INPUT_FILL_EVENT_NAME,
] as const;
