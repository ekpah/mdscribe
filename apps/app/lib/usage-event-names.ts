export const AI_SCRIBE_GENERATION_EVENT_NAME = "ai_scribe_generation";
export const AI_SCRIBE_AGENT_EVENT_NAME = "ai_scribe_agent";
export const AI_INPUT_FILL_EVENT_NAME = "ai_input_fill";
export const AI_SCRIBE_OCR_EVENT_NAME = "ai_scribe_ocr";
export const AI_SCRIBE_STT_EVENT_NAME = "ai_scribe_stt";

export const BILLABLE_SCRIBE_USAGE_EVENT_NAMES = [
	AI_SCRIBE_AGENT_EVENT_NAME,
	AI_SCRIBE_GENERATION_EVENT_NAME,
	AI_INPUT_FILL_EVENT_NAME,
	AI_SCRIBE_OCR_EVENT_NAME,
	AI_SCRIBE_STT_EVENT_NAME,
] as const;
