import "server-only";
import type { Session } from "@/lib/auth-types";

export interface SessionDeviceInfo {
	deviceType: "mobile" | "desktop";
	clientLabel: string;
}

/** An active session enriched with display-ready device info (computed server-side). */
export type ActiveSessionView = Session["session"] & SessionDeviceInfo;

const OPERATING_SYSTEM_PATTERNS: readonly [RegExp, string][] = [
	[/Windows NT/i, "Windows"],
	[/Android/i, "Android"],
	[/iPad|iPhone|iPod/i, "iOS"],
	[/CrOS/i, "Chrome OS"],
	[/Mac OS X|Macintosh/i, "macOS"],
	[/Linux/i, "Linux"],
];

const BROWSER_PATTERNS: readonly [RegExp, string][] = [
	[/Edg(?:A|iOS)?\//i, "Edge"],
	[/OPR\//i, "Opera"],
	[/SamsungBrowser\//i, "Samsung Internet"],
	[/Firefox\/|FxiOS\//i, "Firefox"],
	[/Chrome\/|CriOS\//i, "Chrome"],
	[/Safari\//i, "Safari"],
];

const findClientFamily = (
	userAgent: string,
	patterns: readonly [RegExp, string][],
): string | undefined => {
	for (const [pattern, label] of patterns) {
		if (pattern.test(userAgent)) {
			return label;
		}
	}

	return undefined;
};

/**
 * Derive a display device type + client label from a stored session user-agent
 * string. This intentionally recognizes only common browser and operating
 * system families; unknown clients retain their original user-agent string.
 */
export const getSessionDeviceInfo = (userAgent: string | null | undefined): SessionDeviceInfo => {
	if (userAgent?.includes("tauri-plugin-http")) {
		return { clientLabel: "App", deviceType: "desktop" };
	}

	const value = userAgent ?? "";
	const isMobile = /Android|iPad|iPhone|iPod|IEMobile|Mobile|Opera Mini/i.test(value);
	const osName = findClientFamily(value, OPERATING_SYSTEM_PATTERNS);
	const browserName = findClientFamily(value, BROWSER_PATTERNS);

	const clientLabel =
		osName && browserName
			? `${osName}, ${browserName}`
			: osName || browserName || userAgent || "Unbekannt";

	return {
		clientLabel,
		deviceType: isMobile ? "mobile" : "desktop",
	};
};
