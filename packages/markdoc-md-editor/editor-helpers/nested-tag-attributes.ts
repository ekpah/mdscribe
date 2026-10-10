import { DOMSerializer } from "@tiptap/pm/model";
import type { DOMOutputSpec } from "@tiptap/pm/model";

import {
	parseCalcComponents,
	renderCalcComponentHtml,
} from "../tiptap-extension/editorNodes/calcTag/calc-tag";
import {
	parseCaseElements,
	readTagPrimary,
	renderCaseElements,
} from "../tiptap-extension/editorNodes/case-items";

type Attributes = Record<string, any>;
type Visitor = (kind: string, attrs: Attributes) => Attributes;

/** Visit atom-backed components and case documents as well as ordinary editor nodes. */
export const mapNestedTagAttributes = (
	kind: string,
	attributes: Attributes,
	visit: Visitor,
): Attributes => {
	let attrs = visit(kind, attributes);
	if (Array.isArray(attrs.components)) {
		const components = attrs.components.map((component: Attributes) =>
			mapNestedTagAttributes(`${component.kind}Tag`, component, visit),
		);
		if (components.some((item: Attributes, i: number) => item !== attrs.components[i])) {
			attrs = { ...attrs, components };
		}
	}
	if (Array.isArray(attrs.cases)) {
		const cases = attrs.cases.map((item: Attributes) => {
			if (!item.content) {
				return item;
			}
			const content = mapCaseHtml(item.content, visit);
			return content === item.content ? item : { ...item, content };
		});
		if (cases.some((item: Attributes, i: number) => item !== attrs.cases[i])) {
			attrs = { ...attrs, cases };
		}
	}
	return attrs;
};

const ELEMENT_KINDS: Record<string, string> = {
	calc: "calcTag",
	condition: "conditionTag",
	info: "infoTag",
	score: "calcTag",
	switch: "switchTag",
};

/** Tag attributes that case HTML stores verbatim and visitors may change. */
const SCALAR_ATTRIBUTES = ["description", "formula", "primary", "source", "type", "unit"] as const;

const readElementAttributes = (element: Element, kind: string): Attributes => {
	const attrs: Attributes = Object.fromEntries(
		SCALAR_ATTRIBUTES.map((key) => [key, element.getAttribute(key)]),
	);
	if (kind === "switchTag" || kind === "conditionTag") {
		attrs.cases = parseCaseElements(element);
		attrs.primary = readTagPrimary(element);
	}
	if (kind === "calcTag" && element instanceof HTMLElement) {
		attrs.components = parseCalcComponents(element);
	}
	return attrs;
};

/** Replaces an element's child elements (its cases or calc components) with rendered specs. */
const replaceChildElements = (element: Element, specs: DOMOutputSpec[]): void => {
	for (const child of [...element.children]) {
		child.remove();
	}
	for (const spec of specs) {
		element.append(DOMSerializer.renderSpec(element.ownerDocument, spec).dom);
	}
};

/**
 * Visits the tags inside case HTML and patches what the visitor changed in
 * place: scalar attributes and case values. Unrelated content never passes
 * through the reduced editor schema.
 */
const mapCaseHtml = (html: string, visit: Visitor): string => {
	const container = document.createElement("div");
	container.innerHTML = html;
	let changed = false;
	for (const element of container.querySelectorAll(Object.keys(ELEMENT_KINDS).join(", "))) {
		const kind = ELEMENT_KINDS[element.tagName.toLowerCase()]!;
		const attrs = readElementAttributes(element, kind);
		const next = visit(kind, attrs);
		if (next === attrs) {
			continue;
		}
		for (const key of SCALAR_ATTRIBUTES) {
			const value = next[key];
			if (Object.is(value, attrs[key])) {
				continue;
			}
			if (value === null || value === undefined || value === "") {
				element.removeAttribute(key);
			}
			// Array primaries (conditions) are JSON behind `data-primary-json`.
			else if (Array.isArray(value)) {
				element.setAttribute(key, JSON.stringify(value));
			} else if (typeof value !== "object") {
				element.setAttribute(key, String(value));
			} else {
				continue;
			}
			changed = true;
		}
		// Changed cases or calc components are re-rendered like the editor renders them.
		if (Array.isArray(next.cases) && next.cases !== attrs.cases) {
			replaceChildElements(element, renderCaseElements(next.cases));
			changed = true;
		}
		if (Array.isArray(next.components) && next.components !== attrs.components) {
			replaceChildElements(element, next.components.map(renderCalcComponentHtml));
			changed = true;
		}
	}
	for (const element of container.querySelectorAll("case[data-content]")) {
		const content = decodeURIComponent(element.getAttribute("data-content")!);
		const next = mapCaseHtml(content, visit);
		if (next === content) {
			continue;
		}
		element.setAttribute("data-content", encodeURIComponent(next));
		changed = true;
	}
	return changed ? container.innerHTML : html;
};
