import {
	NARRATIVE_SHARED_CORE_PRINCIPLES,
	NARRATIVE_SHARED_EXCLUSION_CRITERIA,
} from "../families/narrative/shared/common-fragments";

const narrativeCorePrinciples = [
	...NARRATIVE_SHARED_CORE_PRINCIPLES,
	"- ZEITRAUM des stationären Aufenthalts implizit nachvollziehbar halten",
	"- KNAPP UND PRÄZISE formulieren - keine ausschmückende Sprache",
	"- SO KURZ WIE MÖGLICH - unter Berücksichtigung der anderen Anforderungen sollte der Entlassbrief knapp und übersichtlich bleiben",
];

const narrativeExclusionCriteria = [
	...NARRATIVE_SHARED_EXCLUSION_CRITERIA,
	"- NIEMALS selbstverständliche Standardempfehlungen im Procedere",
];

export const NARRATIVE_CONTENT_REQUIREMENTS = `<content_requirements>
<core_principles>
${narrativeCorePrinciples.join("\n")}
</core_principles>

<exclusion_criteria>
${narrativeExclusionCriteria.join("\n")}
</exclusion_criteria>
</content_requirements>`;
