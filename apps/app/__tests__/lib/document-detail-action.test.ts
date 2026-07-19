import { describe, expect, test } from "bun:test";

import { getDocumentDetailAction } from "@/app/documents/_lib/document-detail-action";

describe("document detail action", () => {
	test("lets the author edit", () => {
		expect(
			getDocumentDetailAction({ documentId: "doc-1", isAuthor: true, isLoggedIn: true }),
		).toEqual({ href: "/documents/doc-1/edit", kind: "edit" });
	});

	test("lets another authenticated user fork", () => {
		expect(
			getDocumentDetailAction({ documentId: "doc-1", isAuthor: false, isLoggedIn: true }),
		).toEqual({ href: "/documents/create?fork=doc-1", kind: "fork" });
	});

	test("hides the action for anonymous visitors", () => {
		expect(
			getDocumentDetailAction({ documentId: "doc-1", isAuthor: false, isLoggedIn: false }),
		).toBeNull();
	});
});
