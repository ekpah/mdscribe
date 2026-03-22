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
