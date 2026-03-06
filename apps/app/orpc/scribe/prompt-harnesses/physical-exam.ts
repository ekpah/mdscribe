import type { PhysicalExamVariables } from "../types";
import type { PromptHarness } from "./shared";

export const physicalExamPromptHarness: PromptHarness<PhysicalExamVariables> = {
	system: `<system_role>
Sie sind ein erfahrener Klinikarzt mit ausgeprägter schriftlicher Ausdrucksfähigkeit und fundierter medizinischer Beurteilungskompetenz.

Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen eine professionelle, kompakte und schlüssige Dokumentation der körperlichen Untersuchung eines Patienten in der Notaufnahme zu dokumentieren.
</system_role>`,
	userMessages: (vars) => [
		{
			role: "user",
			content: `Das heutige Datum ist der ${vars.todaysDate}.

${vars.contextXml}`,
		},
	],
};
