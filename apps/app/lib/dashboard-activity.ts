import { formatGeneratedAiFormActivity, USER_MESSAGES } from "@/lib/user-messages";

interface DashboardActivityEvent {
	customFormName?: string | null;
	metadata: unknown;
	name: string;
}

const getMetadata = (metadata: unknown): Record<string, unknown> | null =>
	typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : null;

export const getDashboardActivityTitle = (event: DashboardActivityEvent): string => {
	const eventTitle =
		USER_MESSAGES.dashboard.activity.eventTitles[
			event.name as keyof typeof USER_MESSAGES.dashboard.activity.eventTitles
		];

	if (event.name !== "ai_scribe_generation") {
		if (event.name.includes("template")) {
			return USER_MESSAGES.dashboard.activity.templateUsed;
		}

		return eventTitle ?? USER_MESSAGES.dashboard.activity.unknown;
	}

	if (event.customFormName) {
		return formatGeneratedAiFormActivity(event.customFormName);
	}

	const metadata = getMetadata(event.metadata);
	const promptLabel = typeof metadata?.promptLabel === "string" ? metadata.promptLabel.trim() : "";
	if (promptLabel) {
		return formatGeneratedAiFormActivity(promptLabel);
	}

	return eventTitle ?? USER_MESSAGES.dashboard.activity.unknown;
};
