const CLINICAL_SYSTEM_ROLE_INTRO =
	"Sie sind ein erfahrener Klinikarzt mit ausgeprägter schriftlicher Ausdrucksfähigkeit und fundierter medizinischer Beurteilungskompetenz.";

const buildClinicalSystemRole = (taskDescription: string): string => `<system_role>
${CLINICAL_SYSTEM_ROLE_INTRO}

${taskDescription}
</system_role>`;

export const SYSTEM_ROLE = buildClinicalSystemRole(
	"Ihre Aufgabe ist es, auf Basis der bereitgestellten Informationen eine professionelle, bewertende Epikrise zu erstellen, die den stationären Verlauf strukturiert zusammenfasst und medizinisch logisch verknüpft.",
);

const SHARED_UNCERTAINTY_HANDLING = `<uncertainty_handling>
- Keine Spekulationen oder erfundenen Fakten.
- Bei unklaren Angaben oder Fehlern, lass entsprechende Informationen weg oder drücke die Unsicherheit bzw. die verschiedenen Möglichkeiten aus
- Bei fehlenden Informationen nur dokumentieren, was aus den Eingaben sicher ableitbar ist.
</uncertainty_handling>`;

export const withSharedUncertaintyHandling = (systemPrompt: string): string => {
	if (systemPrompt.includes("<uncertainty_handling>")) {
		return systemPrompt;
	}

	return `${systemPrompt.trim()}\n\n${SHARED_UNCERTAINTY_HANDLING}`;
};
