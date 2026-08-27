type UmamiEventData = Record<string, boolean | number | string>;

interface UmamiTracker {
	track: (eventName: string, eventData?: UmamiEventData) => void;
}

type AnalyticsWindow = Window & {
	umami?: UmamiTracker;
};

export const trackEvent = (eventName: string, eventData?: UmamiEventData): void => {
	if (typeof window === "undefined") {
		return;
	}

	try {
		(window as AnalyticsWindow).umami?.track(eventName, eventData);
	} catch {
		// Analytics must never interrupt a successful user action.
	}
};
