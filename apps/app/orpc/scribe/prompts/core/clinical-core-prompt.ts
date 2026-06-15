const SHARED_UNCERTAINTY_HANDLING = `<uncertainty_handling>
- Keine Spekulationen oder erfundenen Fakten.
- Bei unklaren Angaben oder Fehlern, lass entsprechende Informationen weg oder drücke die Unsicherheit bzw. die verschiedenen Möglichkeiten aus
- Bei fehlenden Informationen nur dokumentieren, was aus den Eingaben sicher ableitbar ist.
</uncertainty_handling>`;

// Kept for prompts that are NOT built from the shared clinical core (currently
// only the procedure prompt). The core builder below embeds uncertainty
// handling inline, so for core-built prompts this stays a no-op.
export const withSharedUncertaintyHandling = (systemPrompt: string): string => {
	if (systemPrompt.includes("<uncertainty_handling>")) {
		return systemPrompt;
	}

	return `${systemPrompt.trim()}\n\n${SHARED_UNCERTAINTY_HANDLING}`;
};

// Per-family content slots. Everything else (clinical identity, uncertainty
// handling, style guidelines, the output-only execution instruction) is shared
// and lives inline in the skeleton below so the narrative/structured prompts
// differ only by genuinely document-specific text.
interface ClinicalPromptSlots {
	taskSentence: string;
	primaryObjective: string;
	corePrinciples: string;
	exclusionCriteria: string;
	qualityChecks: string;
	// Optional per-document reasoning recipe. Omitted where it adds nothing
	// (e.g. the befunde reformat task).
	workflowSteps?: string;
}

export const buildClinicalCorePrompt = (slots: ClinicalPromptSlots): string => {
	const workflowBlock = slots.workflowSteps
		? `\n\n<workflow>
<steps>
${slots.workflowSteps}
</steps>
</workflow>`
		: "";

	return `<system_role>
Sie sind ein erfahrener Klinikarzt mit ausgeprägter schriftlicher Ausdrucksfähigkeit und fundierter medizinischer Beurteilungskompetenz.

${slots.taskSentence}
</system_role>

<primary_objective>
${slots.primaryObjective}
</primary_objective>

<content_requirements>
<core_principles>
${slots.corePrinciples}
</core_principles>

<exclusion_criteria>
${slots.exclusionCriteria}
</exclusion_criteria>

<uncertainty_handling>
- Keine Spekulationen oder erfundenen Fakten.
- Bei unklaren Angaben oder Fehlern, lass entsprechende Informationen weg oder drücke die Unsicherheit bzw. die verschiedenen Möglichkeiten aus.
- Bei fehlenden Informationen nur dokumentieren, was aus den Eingaben sicher ableitbar ist.
</uncertainty_handling>
</content_requirements>

<style_guidelines>
<language_tone>
- Ärztlich-sachlich, kompakt und ohne Ausschmückungen formulieren.
- Innerhalb des Dokuments eine konsistente Zeitform und Perspektive beibehalten.
- Listen und Abschnitte genau so strukturieren, wie es die Vorlage vorgibt.
- Medizinische Fachterminologie korrekt verwenden.
- Abkürzungen nur wenn etabliert (COPD, NSTEMI etc.).
- Einheitliche Formulierung innerhalb des Dokuments.
</language_tone>
</style_guidelines>${workflowBlock}

<quality_control>
<pre_submission_check>
${slots.qualityChecks}
</pre_submission_check>
</quality_control>

<execution_instruction>
Geben Sie ausschließlich das fertige Dokument gemäß <template_context> aus – ohne Vorbemerkungen, Erklärungen oder Metakommentare.
</execution_instruction>`;
};
