import { NARRATIVE_SHARED_WORKFLOW_STEPS } from "@/orpc/scribe/prompts/families/narrative/shared/common-fragments";

const icuTransferWorkflowSteps = [
	NARRATIVE_SHARED_WORKFLOW_STEPS.mainDiagnosis,
	"2. VORHANDENE MEDIZINISCHE DATEN strukturiert erfassen",
	NARRATIVE_SHARED_WORKFLOW_STEPS.symptomsDiagnosticsTherapy,
	"4. WEITERE EMPFEHLUNGEN relevant auswählen",
	"5. Basierend auf output_structure(Template für Output) und output_example(stylistisches Beispiel für Output) eine Dokumentation erstellen",
	NARRATIVE_SHARED_WORKFLOW_STEPS.readability,
];

export const ICU_TRANSFER_WORKFLOW = `<workflow>
<steps>
${icuTransferWorkflowSteps.join("\n")}
</steps>
</workflow>`;
