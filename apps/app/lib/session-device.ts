import "server-only";

import { UAParser } from "ua-parser-js";

import type { Session } from "@/lib/auth-types";

export interface SessionDeviceInfo {
	deviceType: "mobile" | "desktop";
	clientLabel: string;
}

/** An active session enriched with display-ready device info (computed server-side). */
export type ActiveSessionView = Session["session"] & SessionDeviceInfo;

/**
 * Derive a display device type + client label from a stored session user-agent
 * string. Runs server-side so `ua-parser-js` never ships in the client bundle.
 */
export const getSessionDeviceInfo = (
	userAgent: string | null | undefined
): SessionDeviceInfo => {
	if (userAgent?.includes("tauri-plugin-http")) {
		return { clientLabel: "App", deviceType: "desktop" };
	}

	const parser = UAParser(userAgent ?? "");
	const osName = parser.os.name;
	const browserName = parser.browser.name;

	const clientLabel =
		osName && browserName
			? `${osName}, ${browserName}`
			: osName || browserName || userAgent || "Unbekannt";

	return {
		clientLabel,
		deviceType: parser.device.type === "mobile" ? "mobile" : "desktop",
	};
};
