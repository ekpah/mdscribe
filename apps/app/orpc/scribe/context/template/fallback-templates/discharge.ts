import { NARRATIVE_OUTPUT_STRUCTURE } from "@/orpc/scribe/prompts/families/narrative/discharge-output-structure";

export const DISCHARGE_FALLBACK_TEMPLATE = {
	content: NARRATIVE_OUTPUT_STRUCTURE,
	examples: [] as string[],
	title: "Standardstruktur Entlassbrief",
};
