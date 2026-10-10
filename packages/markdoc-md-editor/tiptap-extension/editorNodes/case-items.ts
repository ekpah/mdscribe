import { getHTMLFromFragment } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { htmlToMarkdoc } from "markdoc-md/editor";

import type { CaseConditionAttrs } from "./case-condition";
import { CASE_CONDITION_KEYS } from "./case-condition";

/** One case of a switch or condition, stored as an attribute of its atom node. */
export interface SwitchCase extends CaseConditionAttrs {
	primary: string;
	text: string;
	/** Rich case content as editor HTML. */
	content?: string;
	value?: number;
}

const decodeCaseContent = (value: string | null): string => {
	if (!value) {
		return "";
	}
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
};

/**
 * HTML attribute values are JSON-encoded, so arrays and even invalid literals
 * survive an editor roundtrip and remain visible to validation.
 */
const readCaseLiteral = (raw: string | null): any => {
	if (raw === null) {
		return undefined;
	}
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

/** A switch or condition primary; `data-primary-json` marks a JSON literal such as an array. */
export const readTagPrimary = (element: Element): string | string[] | null =>
	element.getAttribute("data-primary-json") === "true"
		? readCaseLiteral(element.getAttribute("primary"))
		: element.getAttribute("primary");

const renderTagPrimary = (primary: unknown) => {
	const literal = typeof primary !== "string" && primary !== null && primary !== undefined;
	return {
		"data-primary-json": literal ? "true" : undefined,
		primary: literal ? JSON.stringify(primary) : primary,
	};
};

export const parseCaseElements = (element: Element): SwitchCase[] =>
	[...element.children]
		.filter(
			(child): child is HTMLElement =>
				child instanceof HTMLElement && child.tagName.toLowerCase() === "case",
		)
		.map((child) => ({
			content: decodeCaseContent(child.getAttribute("data-content")) || child.innerHTML,
			primary: child.getAttribute("primary") ?? "",
			text: (child.textContent ?? "").trim(),
			value: readCaseLiteral(child.getAttribute("value")),
			...Object.fromEntries(
				CASE_CONDITION_KEYS.flatMap((key) => {
					const raw = child.getAttribute(key);
					return raw === null ? [] : [[key, readCaseLiteral(raw)]];
				}),
			),
			isDefault: child.getAttribute("default") === "true",
		}));

export const renderCaseElements = (cases: readonly SwitchCase[]): DOMOutputSpec[] =>
	cases.map((item) => [
		"Case",
		{
			"data-content": encodeURIComponent(item.content ?? item.text ?? ""),
			default: item.isDefault ? "true" : undefined,
			primary: item.primary || undefined,
			value: JSON.stringify(item.value),
			...Object.fromEntries(CASE_CONDITION_KEYS.map((key) => [key, JSON.stringify(item[key])])),
		},
		item.text ?? "",
	]);

/** The tag-level attributes shared by switch and condition nodes and calc components. */
export interface BranchingTagAttrs {
	cases: SwitchCase[];
	description?: string | null;
	primary: string | string[] | null;
	source?: string | null;
	type?: string | null;
	unit?: string | null;
}

/** Editor HTML for a switch or condition; atom nodes keep their cases as child elements. */
export const renderBranchingTagHtml = (
	tag: "Condition" | "Switch",
	attrs: BranchingTagAttrs,
	htmlAttributes: Record<string, unknown> = {},
): DOMOutputSpec => [
	tag,
	{
		...htmlAttributes,
		...renderTagPrimary(attrs.primary),
		description: attrs.description,
		source: attrs.source,
		type: tag === "Switch" ? attrs.type : undefined,
		unit: attrs.unit,
	},
	...renderCaseElements(attrs.cases),
];

export const toBranchingAttrs = (node: ProseMirrorNode): BranchingTagAttrs => ({
	...(node.attrs as BranchingTagAttrs),
	cases: Array.isArray(node.attrs.cases) ? (node.attrs.cases as SwitchCase[]) : [],
});

/**
 * Markdoc source of an atom tag node, through the same HTML conversion the
 * editor saves with, so plain-text copies match saved templates exactly.
 */
export const nodeToMarkdoc = (node: ProseMirrorNode): string =>
	htmlToMarkdoc(getHTMLFromFragment(Fragment.from(node), node.type.schema)).trim();
