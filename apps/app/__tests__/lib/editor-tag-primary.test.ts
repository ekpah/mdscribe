import { describe, expect, test } from "bun:test";

import { Schema } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { getPrimaryFromSelection } from "markdoc-md-editor/editor-helpers/get-primary-from-selection";
import {
	FOCUS_INSERTED_TAG_PRIMARY_META,
	selectInsertedInlineTag,
} from "markdoc-md-editor/editor-helpers/select-inserted-inline-tag";
import { updateMarkdocTagAttributesInTransaction } from "markdoc-md-editor/tag-inspector/use-selected-markdoc-tag";
import { isCursorAfterInlineMarkdocTag } from "markdoc-md-editor/tiptap-extension";
import { ensureCalcFormulaComponents } from "markdoc-md-editor/tiptap-extension/editorNodes/scoreTag/score-tag";

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

describe("inserted Markdoc tag selection", () => {
	test("requests primary input focus when selecting the inserted inline tag", () => {
		const schema = new Schema({
			nodes: {
				doc: { content: "inline*" },
				infoTag: { atom: true, group: "inline", inline: true },
				text: { group: "inline" },
			},
		});
		const doc = schema.node("doc", null, [schema.text("selected text"), schema.node("infoTag")]);
		const state = EditorState.create({
			doc,
			schema,
			selection: TextSelection.create(doc, doc.content.size),
		});
		const dispatchedTransactions: Transaction[] = [];

		selectInsertedInlineTag({
			dispatch: (transaction) => {
				dispatchedTransactions.push(transaction);
			},
			tr: state.tr,
		});

		const [transaction] = dispatchedTransactions;
		expect(transaction).toBeDefined();
		expect(transaction?.selection).toBeInstanceOf(NodeSelection);
		expect(transaction?.getMeta(FOCUS_INSERTED_TAG_PRIMARY_META)).toBe(true);
	});
});

describe("newline after an inline Markdoc tag", () => {
	const schema = new Schema({
		nodes: {
			doc: { content: "block+" },
			hardBreak: { group: "inline", inline: true },
			infoTag: { atom: true, group: "inline", inline: true },
			paragraph: { content: "inline*", group: "block" },
			text: { group: "inline" },
		},
	});

	test("uses a hard break when the cursor is directly after a tag at the end of a line", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, [schema.text("Date: "), schema.node("infoTag")]),
		]);
		const state = EditorState.create({
			doc,
			schema,
			selection: TextSelection.atEnd(doc),
		});

		expect(isCursorAfterInlineMarkdocTag(state)).toBe(true);
	});

	test("keeps normal Enter behavior when text follows the tag", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, [schema.node("infoTag"), schema.text(" trailing text")]),
		]);
		const state = EditorState.create({
			doc,
			schema,
			selection: TextSelection.atEnd(doc),
		});

		expect(isCursorAfterInlineMarkdocTag(state)).toBe(false);
	});
});

describe("shared Markdoc tag settings", () => {
	test("silently adds missing formula components to calc tags", () => {
		const schema = new Schema({
			nodes: {
				doc: { content: "inline*" },
				infoTag: {
					atom: true,
					attrs: {
						description: { default: null },
						primary: { default: null },
						renderUnit: { default: false },
						source: { default: null },
						type: { default: null },
						unit: { default: null },
					},
					group: "inline",
					inline: true,
				},
				scoreTag: {
					atom: true,
					attrs: {
						components: { default: [] },
						formula: { default: null },
						primary: { default: null },
					},
					group: "inline",
					inline: true,
				},
				text: { group: "inline" },
			},
		});
		const age = schema.node("infoTag", {
			description: "Age in years",
			primary: "age",
			source: "fhir://Patient.age",
			type: "number",
			unit: "years",
		});
		const calc = schema.node("scoreTag", {
			components: [],
			formula: "[age] + [missing]",
			primary: "risk",
		});
		const doc = schema.node("doc", null, [age, schema.text(" "), calc]);
		const state = EditorState.create({ doc, schema });
		const transaction = state.tr;

		expect(ensureCalcFormulaComponents(transaction)).toBe(true);
		const nextCalc = state.apply(transaction).doc.lastChild;
		expect(nextCalc?.attrs.components).toEqual([
			{
				description: "Age in years",
				kind: "info",
				primary: "age",
				renderUnit: false,
				source: "fhir://Patient.age",
				type: "number",
				unit: "years",
			},
			{ kind: "info", primary: "missing", type: "number" },
		]);
		expect(ensureCalcFormulaComponents(state.apply(transaction).tr)).toBe(false);
	});

	test("updates required shared attributes on every duplicate and contained score component", () => {
		const schema = new Schema({
			nodes: {
				doc: { content: "inline*" },
				infoTag: {
					atom: true,
					attrs: {
						description: { default: null },
						primary: { default: null },
						renderUnit: { default: false },
						source: { default: null },
						type: { default: null },
						unit: { default: null },
					},
					group: "inline",
					inline: true,
				},
				scoreTag: {
					atom: true,
					attrs: {
						components: { default: [] },
						formula: { default: null },
						primary: { default: null },
					},
					group: "inline",
					inline: true,
				},
				text: { group: "inline" },
			},
		});
		const first = schema.node("infoTag", {
			primary: "age",
			renderUnit: true,
			source: "fhir://Patient.age",
			type: "number",
			unit: "years",
		});
		const second = schema.node("infoTag", {
			primary: "age",
			renderUnit: false,
			source: "fhir://Patient.age",
			type: "number",
			unit: "years",
		});
		const score = schema.node("scoreTag", {
			components: [
				{
					kind: "info",
					primary: "age",
					renderUnit: false,
					source: "fhir://Patient.age",
					type: "number",
					unit: "years",
				},
			],
			formula: "[age]",
			primary: "risk",
		});
		const doc = schema.node("doc", null, [first, schema.text(" "), second, score]);
		const positions: number[] = [];
		doc.descendants((node, pos) => {
			if (node.type.name === "infoTag") {
				positions.push(pos);
			}
		});
		const state = EditorState.create({ doc, schema });
		const transaction = state.tr;
		expect(
			updateMarkdocTagAttributesInTransaction(transaction, positions[0] ?? -1, {
				primary: "patientAge",
				renderUnit: true,
				source: "fhir://Patient.extension.where(url='age').value",
				unit: "Jahre",
			}),
		).toBe(true);
		const nextState = state.apply(transaction);
		const infoNodes: { attrs: Record<string, unknown> }[] = [];
		nextState.doc.descendants((node) => {
			if (node.type.name === "infoTag") {
				infoNodes.push(node);
			}
		});
		expect(infoNodes.map((node) => node.attrs.primary)).toEqual(["patientAge", "patientAge"]);
		expect(infoNodes.map((node) => node.attrs.source)).toEqual([
			"fhir://Patient.extension.where(url='age').value",
			"fhir://Patient.extension.where(url='age').value",
		]);
		expect(infoNodes.map((node) => node.attrs.unit)).toEqual(["Jahre", "Jahre"]);
		expect(infoNodes.map((node) => node.attrs.renderUnit)).toEqual([true, false]);
		const nextScore = nextState.doc.lastChild;
		expect(nextScore?.attrs.components).toEqual([
			{
				kind: "info",
				primary: "patientAge",
				renderUnit: false,
				source: "fhir://Patient.extension.where(url='age').value",
				type: "number",
				unit: "Jahre",
			},
		]);
	});

	test("updates shared calc settings without changing instance presentation", () => {
		const schema = new Schema({
			nodes: {
				doc: { content: "inline*" },
				scoreTag: {
					atom: true,
					attrs: {
						components: { default: [] },
						formula: { default: null },
						primary: { default: null },
						renderUnit: { default: false },
						unit: { default: null },
					},
					group: "inline",
					inline: true,
				},
				text: { group: "inline" },
			},
		});
		const first = schema.node("scoreTag", {
			formula: "[age]",
			primary: "risk",
			renderUnit: true,
			unit: "Punkte",
		});
		const second = schema.node("scoreTag", {
			formula: "[age]",
			primary: "risk",
			renderUnit: true,
			unit: "Prozent",
		});
		const doc = schema.node("doc", null, [first, schema.text(" "), second]);
		const state = EditorState.create({ doc, schema });
		const transaction = state.tr;

		expect(
			updateMarkdocTagAttributesInTransaction(transaction, 0, {
				primary: "renamedRisk",
				renderUnit: false,
				unit: "Neue Punkte",
			}),
		).toBe(true);

		const calcAttributes: Record<string, unknown>[] = [];
		state.apply(transaction).doc.descendants((node) => {
			if (node.type.name === "scoreTag") {
				calcAttributes.push(node.attrs);
			}
		});
		expect(calcAttributes.map(({ primary }) => primary)).toEqual(["renamedRisk", "renamedRisk"]);
		expect(calcAttributes.map(({ renderUnit }) => renderUnit)).toEqual([false, true]);
		expect(calcAttributes.map(({ unit }) => unit)).toEqual(["Neue Punkte", "Prozent"]);
	});

	test("updates switch case score values from a score component everywhere", () => {
		const schema = new Schema({
			nodes: {
				doc: { content: "inline*" },
				scoreTag: {
					atom: true,
					attrs: {
						components: { default: [] },
						formula: { default: null },
						primary: { default: null },
					},
					group: "inline",
					inline: true,
				},
				switchTag: {
					atom: true,
					attrs: {
						cases: { default: [] },
						primary: { default: null },
						source: { default: null },
						type: { default: null },
					},
					group: "inline",
					inline: true,
				},
				text: { group: "inline" },
			},
		});
		const cases = [
			{ primary: "low", value: 0 },
			{ primary: "high", value: 2 },
		];
		const component = { cases, kind: "switch", primary: "riskLevel", type: "string" };
		const switchTag = schema.node("switchTag", { cases, primary: "riskLevel", type: "string" });
		const firstScore = schema.node("scoreTag", {
			components: [component],
			formula: "[riskLevel]",
			primary: "risk",
		});
		const secondScore = schema.node("scoreTag", {
			components: [component],
			formula: "[riskLevel] * 2",
			primary: "otherRisk",
		});
		const doc = schema.node("doc", null, [switchTag, firstScore, secondScore]);
		let firstScorePos = -1;
		doc.descendants((node, pos) => {
			if (node.type.name === "scoreTag" && firstScorePos === -1) {
				firstScorePos = pos;
			}
		});
		const state = EditorState.create({ doc, schema });
		const transaction = state.tr;
		expect(
			updateMarkdocTagAttributesInTransaction(transaction, firstScorePos, {
				components: [
					{
						...component,
						cases: [
							{ primary: "low", value: 0 },
							{ primary: "high", value: 4 },
						],
					},
				],
			}),
		).toBe(true);

		const nextState = state.apply(transaction);
		const highValues: unknown[] = [];
		nextState.doc.descendants((node) => {
			if (node.type.name === "switchTag") {
				highValues.push(node.attrs.cases[1]?.value);
			}
			if (node.type.name === "scoreTag") {
				highValues.push(node.attrs.components[0]?.cases[1]?.value);
			}
		});
		expect(highValues).toEqual([4, 4, 4]);
	});
});
