export const NARRATIVE_SHARED_CORE_PRINCIPLES = [
	"- BEWERTUNG UND KAUSALITÄT über reine Befundaufzählung stellen",
	"- THERAPIE- oder MEDIKATIONSÄNDERUNGEN müssen BEGRÜNDET werden",
	"- BEWUSST UNTERLASSENE MASSNAHMEN (insbesondere Leitlinienabweichungen) BEGRÜNDEN",
] as const;

export const NARRATIVE_SHARED_EXCLUSION_CRITERIA = [
	"- NIEMALS Aufzählung einzelner Maßnahmen oder Befunde",
	"- NIEMALS Negativbefunde (außer wenn essenziell für Hauptdiagnose)",
	"- NIEMALS Inhalte erwähnen, die nicht in den Notizen stehen",
] as const;

export const NARRATIVE_SHARED_STYLE_LANGUAGE_TONE = [
	"- VERGANGENHEITSFORM durchgehend",
	"- ÄRZTLICH-SACHLICH ohne Ausschmückungen",
	"- BEWERTENDE SPRACHE statt deskriptive Aufzählung",
] as const;

export const NARRATIVE_SHARED_WORKFLOW_STEPS = {
	mainDiagnosis: "1. HAUPTDIAGNOSE IDENTIFIZIEREN als roten Faden",
	readability: "6. NATÜRLICHEN LESEFLUSS sicherstellen",
	symptomsDiagnosticsTherapy:
		"3. SYMPTOME, DIAGNOSTIK UND THERAPIE bewertend verknüpfen",
} as const;
