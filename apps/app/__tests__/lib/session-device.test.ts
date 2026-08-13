import { describe, expect, test } from "bun:test";

import { getSessionDeviceInfo } from "@/lib/session-device";

describe("getSessionDeviceInfo", () => {
	test("recognizes a common desktop browser", () => {
		expect(
			getSessionDeviceInfo(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
			),
		).toEqual({ clientLabel: "Windows, Chrome", deviceType: "desktop" });
	});

	test("recognizes a common mobile browser", () => {
		expect(
			getSessionDeviceInfo(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1",
			),
		).toEqual({ clientLabel: "iOS, Safari", deviceType: "mobile" });
	});

	test("identifies the desktop app", () => {
		expect(getSessionDeviceInfo("tauri-plugin-http/2.0")).toEqual({
			clientLabel: "App",
			deviceType: "desktop",
		});
	});

	test("preserves unknown user agents", () => {
		expect(getSessionDeviceInfo("CustomClient/1.0")).toEqual({
			clientLabel: "CustomClient/1.0",
			deviceType: "desktop",
		});
	});

	test("handles an absent user agent", () => {
		expect(getSessionDeviceInfo(null)).toEqual({
			clientLabel: "Unbekannt",
			deviceType: "desktop",
		});
	});
});
