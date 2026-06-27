import { describe, expect, test } from "bun:test";

import { resolveWorkspaceSectionTemplate } from "@/orpc/scribe-workspaces";

describe("AI Scribe Workspace template resolution", () => {
	test("uses visible linked template content", () => {
		const template = resolveWorkspaceSectionTemplate({
			form: {
				id: "diagnosis-form",
				promptHarness: "diagnosis",
				template: {
					authorId: "owner",
					content: "## Diagnosen\n\n- Hauptdiagnose: ...\n- Nebendiagnosen: ...",
					title: "Diagnose-Struktur",
					visibility: "public",
				},
				templateId: "template-id",
			},
			viewerId: "viewer",
		});

		expect(template).toEqual({
			content: "## Diagnosen\n\n- Hauptdiagnose: ...\n- Nebendiagnosen: ...",
			title: "Diagnose-Struktur",
		});
	});

	test("returns null when the linked template is private for another viewer", () => {
		const template = resolveWorkspaceSectionTemplate({
			form: {
				id: "diagnosis-form",
				promptHarness: "diagnosis",
				template: {
					authorId: "owner",
					content: "## Private Diagnose-Struktur\n\nNicht anzeigen",
					title: "Private Diagnose-Struktur",
					visibility: "private",
				},
				templateId: "template-id",
			},
			viewerId: "viewer",
		});

		expect(template).toBeNull();
	});
});
