import { describe, expect, test } from "bun:test";

import { getDashboardActivityTitle } from "@/lib/dashboard-activity";

describe("dashboard activity titles", () => {
	test("uses a readable title for PDF enhancements", () => {
		expect(
			getDashboardActivityTitle({
				metadata: null,
				name: "ai_pdf_document_enhancement",
			}),
		).toBe("PDF-Formular mit KI optimiert");
	});

	test("uses the custom AI form name instead of its slug", () => {
		expect(
			getDashboardActivityTitle({
				customFormName: "Kardiologischer Kurzbrief",
				metadata: {
					customFormSlug: "kardiologischer-kurzbrief",
					endpoint: "custom:kardiologischer-kurzbrief",
				},
				name: "ai_scribe_generation",
			}),
		).toBe("Kardiologischer Kurzbrief generiert");
	});

	test("never exposes an unknown event identifier", () => {
		expect(
			getDashboardActivityTitle({
				metadata: null,
				name: "future_internal_event_slug",
			}),
		).toBe("KI-Funktion verwendet");
	});
});
