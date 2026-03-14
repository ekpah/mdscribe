import { NARRATIVE_SHARED_WORKFLOW_STEPS } from "./common-fragments";

const narrativeWorkflowSteps = [
	NARRATIVE_SHARED_WORKFLOW_STEPS.mainDiagnosis,
	"2. DEMOGRAFISCHE DATEN strukturiert erfassen (Name, Alter, Geschlecht)",
	NARRATIVE_SHARED_WORKFLOW_STEPS.symptomsDiagnosticsTherapy,
	"4. AMBULANTE EMPFEHLUNGEN relevant auswählen",
	NARRATIVE_SHARED_WORKFLOW_STEPS.readability,
];

export const NARRATIVE_WORKFLOW = `<workflow>
<steps>
${narrativeWorkflowSteps.join("\n")}
</steps>
</workflow>`;
