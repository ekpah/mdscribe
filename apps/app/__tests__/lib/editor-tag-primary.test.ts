import { describe, expect, test } from "bun:test";

import { getPrimaryFromSelection } from "@repo/design-system/components/editor/_lib/get-primary-from-selection";

type SelectionState = Parameters<typeof getPrimaryFromSelection>[0];

/* oxlint-disable promise/prefer-await-to-callbacks -- ProseMirror's nodesBetween API is synchronous and callback-based. */
const createSelectionState = ({
	isEmpty = false,
	segments = [],
}: {
	isEmpty?: boolean;
	segments?: (string | { attrs: { primary?: unknown }; type: { name: string } })[];
}): SelectionState =>
	({
		doc: {
			textBetween: (
				_from: number,
				_to: number,
				_blockSeparator: string,
				leafText: (node: Exclude<(typeof segments)[number], string>) => string,
			) =>
				segments
					.map((segment) => (typeof segment === "string" ? segment : leafText(segment)))
					.join(""),
		},
		selection: {
			empty: isEmpty,
			from: 1,
			to: 2,
		},
	}) as unknown as SelectionState;
/* oxlint-enable promise/prefer-await-to-callbacks */

describe("Markdoc tag insertion primary", () => {
	test("uses the selected plain text", () => {
		const state = createSelectionState({ segments: ["selected text"] });

		expect(getPrimaryFromSelection(state)).toBe("selected text");
	});

	test("uses the primary of a selected Markdoc tag", () => {
		const state = createSelectionState({
			segments: [{ attrs: { primary: "Existing primary" }, type: { name: "infoTag" } }],
		});

		expect(getPrimaryFromSelection(state)).toBe("Existing primary");
	});

	test("merges text and Markdoc tag primaries in document order", () => {
		const state = createSelectionState({
			segments: [
				"before ",
				{ attrs: { primary: "Score primary" }, type: { name: "scoreTag" } },
				" between ",
				{ attrs: { primary: "Info primary" }, type: { name: "infoTag" } },
				" after",
			],
		});

		expect(getPrimaryFromSelection(state)).toBe("before Score primary between Info primary after");
	});

	test("does not derive a primary from a collapsed selection", () => {
		const state = createSelectionState({
			isEmpty: true,
			segments: ["ignored"],
		});

		expect(getPrimaryFromSelection(state)).toBeNull();
	});
});
