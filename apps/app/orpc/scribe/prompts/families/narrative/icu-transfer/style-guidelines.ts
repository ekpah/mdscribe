import { NARRATIVE_SHARED_STYLE_LANGUAGE_TONE } from "@/orpc/scribe/prompts/families/narrative/shared/common-fragments";

const icuTransferStyleLanguageTone = [
	...NARRATIVE_SHARED_STYLE_LANGUAGE_TONE,
	"- Kausale Formulierungen bevorzugen („unter ... kam es zu ...“ statt „es wurden ... durchgeführt“).",
	"- Jede Maßnahme oder Änderung medizinisch begründen.",
	"- Lesefluss und inhaltliche Logik prüfen – kein Listencharakter, wenn nicht explizit als Stichpunkte gefordert.",
];

export const ICU_TRANSFER_STYLE_GUIDELINES = `<style_guidelines>
<language_tone>
${icuTransferStyleLanguageTone.join("\n")}
</language_tone>
</style_guidelines>`;
