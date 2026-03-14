import {
	NARRATIVE_SHARED_CORE_PRINCIPLES,
	NARRATIVE_SHARED_EXCLUSION_CRITERIA,
} from "@/orpc/scribe/prompts/families/narrative/shared/common-fragments";

const icuTransferCorePrinciples = [
	...NARRATIVE_SHARED_CORE_PRINCIPLES,
	"- KNAPP UND PRÄZISE formulieren - keine ausschmückende Sprache",
];

export const ICU_TRANSFER_CONTENT_REQUIREMENTS = `<content_requirements>
<core_principles>
${icuTransferCorePrinciples.join("\n")}
</core_principles>

<exclusion_criteria>
${NARRATIVE_SHARED_EXCLUSION_CRITERIA.join("\n")}
</exclusion_criteria>
</content_requirements>`;
