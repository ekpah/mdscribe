export interface PlaygroundComparisonReference {
	label: string;
	runId?: string;
	text: string;
}

interface PlaygroundRunResponse {
	id: string;
	isStreaming: boolean;
	text: string;
}

export const resolvePlaygroundComparisonReference = ({
	firstResult,
	usageEventResponse,
}: {
	firstResult: PlaygroundRunResponse | undefined;
	usageEventResponse: string | undefined;
}): PlaygroundComparisonReference | null => {
	const usageEventText = usageEventResponse?.trim();
	if (usageEventText) {
		return {
			label: "der Usage-Event-Antwort",
			text: usageEventText,
		};
	}

	if (!firstResult) {
		return null;
	}

	const resultText = firstResult.text.trim();
	if (!resultText || firstResult.isStreaming) {
		return null;
	}

	return {
		label: "dem ersten Ergebnis",
		runId: firstResult.id,
		text: resultText,
	};
};
