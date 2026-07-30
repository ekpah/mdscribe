import { PROCEDURES_OUTPUT_STRUCTURE } from "@/orpc/scribe/prompts/families/procedure/index";

export const PROCEDURES_FALLBACK_TEMPLATE = {
	content: PROCEDURES_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Prozedurbefund",
};
