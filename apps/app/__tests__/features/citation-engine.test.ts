import { describe, expect, test } from "bun:test";

import { citeMarkdown } from "../../features/citation-engine";
import type { CitationSource, Decide } from "../../features/citation-engine";

const words = (text: string) => new Set(text.toLowerCase().match(/[a-zäöüß]{5,}/gu));

/**
 * A lenient fake model: any passage sharing a long word with the claim supports
 * it, and every claim is written in the sources except a delirium, which the
 * notes only imply through a fever.
 */
const decide: Decide = (questions, state) => {
	const passages = new Map<string, string>(
		(
			JSON.parse(state) as { sources: { passages: { id: string; text: string }[] }[] }
		).sources.flatMap((source) => source.passages.map((passage) => [passage.id, passage.text])),
	);
	return Promise.resolve({
		answers: Object.fromEntries(
			Object.entries(questions).map(([id, question]) => {
				const claim = /Claim: «([^»]+)»/u.exec(question.instructions)?.[1] ?? "";
				const passage = passages.get(id.split("_").at(-1) ?? "") ?? "";
				if (id.startsWith("f_")) {
					const written = !claim.includes("Delir");
					return [
						id,
						{
							choice: written ? "stated" : "interpreted",
							probabilities: {
								absent: 0.02,
								interpreted: written ? 0.03 : 0.95,
								stated: written ? 0.95 : 0.03,
							},
						},
					];
				}
				const shared = [...words(claim)].some((word) => words(passage).has(word));
				return [id, { noul: shared ? 0.9 : 0.05 }];
			}),
		),
	});
};

const notes: CitationSource = {
	label: "Notizen",
	source: "mdscribe://input/notes",
	text: "Aufnahme mit Fieber.\nRöntgen: Infiltrat rechts basal, vereinbar mit Pneumonie.",
};
const lab: CitationSource = {
	label: "Labor.png",
	pages: [
		{
			blocks: [
				{ bbox: { height: 30, width: 400, x: 100, y: 100 }, text: "Laborbefund" },
				{
					bbox: { height: 90, width: 400, x: 100, y: 300 },
					text: "<table><tr><td>Parameter</td><td>Wert</td></tr><tr><td>Kalium</td><td>3,4</td></tr><tr><td>Natrium</td><td>131</td></tr></table>",
				},
			],
			height: 1000,
			pageNumber: 1,
			width: 1000,
		},
	],
	source: "mdscribe://file/labor",
	text: "Laborbefund\n\n<table><tr><td>Parameter</td><td>Wert</td></tr><tr><td>Kalium</td><td>3,4</td></tr><tr><td>Natrium</td><td>131</td></tr></table>",
};

describe("citation engine", () => {
	test("cites filled values with located evidence and drops values the evidence contradicts", async () => {
		const citations = await citeMarkdown({
			decide,
			markdown: `Kalium {% info "Kalium" type="number" unit="mmol/l" /%}, Natrium {% info "Natrium" type="number" unit="mmol/l" /%}.
Diagnose: {% info "Diagnose" /%}`,
			sources: [notes, lab],
			values: { Diagnose: "Pneumonie", Kalium: 3.4, Natrium: 141 },
		});
		expect(citations.map(({ target }) => target)).toEqual([
			{ key: "Kalium", kind: "value" },
			{ key: "Diagnose", kind: "value" },
		]);
		const [kalium, diagnose] = citations;
		expect(kalium.evidence).toHaveLength(1);
		expect(kalium.evidence[0].source).toBe("mdscribe://file/labor");
		// The Kalium row is the second of three table rows inside the OCR block.
		const [{ locator }] = kalium.evidence;
		if (locator?.kind !== "page") {
			throw new Error("expected a page locator");
		}
		expect(locator.page).toBe(1);
		expect(locator.box.x).toBeCloseTo(0.1);
		expect(locator.box.y).toBeCloseTo(0.33);
		expect(locator.box.width).toBeCloseTo(0.4);
		expect(locator.box.height).toBeCloseTo(0.03);
		const pneumonia = notes.text.indexOf("Röntgen");
		expect(diagnose.evidence).toEqual([
			{
				locator: { end: notes.text.length, kind: "text", start: pneumonia },
				quote: notes.text.slice(pneumonia),
				source: notes.source,
			},
		]);
	});

	test("cites written facts, skips interpretations, and cites a value after an ungrounded label", async () => {
		const markdown =
			"Pneumonie rechts basal, Fieber.\nAkutes Delir bei Fieber\nBGA vom 14.11.2026: Kalium 3,4 mmol/l";
		const citations = await citeMarkdown({ decide, markdown, sources: [notes, lab] });
		expect(
			citations.map(({ target }) =>
				target.kind === "span" ? markdown.slice(target.start, target.end) : target.key,
			),
		).toEqual(["Pneumonie rechts basal", "Fieber", "Kalium 3,4 mmol/l"]);
	});
});
