import { analyzeMarkdocTemplate } from "markdoc-md/parse";

import type { CitationTarget } from "./types";

export interface Span {
	end: number;
	start: number;
	text: string;
}

/** One checkable fact: a filled value or a part of a sentence. */
export interface Claim {
	/** What the evidence must ground (numbers, wording): the item, or a value without its label. */
	checked: string;
	/** The sentence (or field label) the claim is read in. */
	context: string;
	id: string;
	target: CitationTarget;
	text: string;
}

const trimSpan = (text: string, start: number): Span | null => {
	const lead = text.length - text.trimStart().length;
	const trimmed = text.trim();
	return trimmed
		? { end: start + lead + trimmed.length, start: start + lead, text: trimmed }
		: null;
};

/** Sentence split that keeps dates ("am 01.11. Schmerzen") and abbreviations ("V. a.") intact. */
export const splitSentences = (text: string, offset: number): Span[] => {
	const spans: Span[] = [];
	let from = 0;
	for (const match of text.matchAll(/[.!?]\s+(?=[A-ZÄÖÜ])/gu)) {
		const cut = match.index + 1;
		const before = text.slice(0, cut);
		if (
			/(?:^|\s)\d{1,2}\.\d{1,2}\.$/u.test(before) ||
			/(?:^|\s)(?:[A-Za-z]\.){1,2}$|\b(?:ca|bzw|ggf|Dr|z|v|V|Z)\.$/u.test(before)
		) {
			continue;
		}
		spans.push({ end: offset + cut, start: offset + from, text: text.slice(from, cut) });
		from = match.index + match[0].length;
	}
	spans.push({ end: offset + text.length, start: offset + from, text: text.slice(from) });
	return spans.flatMap((span) => trimSpan(span.text, span.start) ?? []);
};

/** Top-level comma, semicolon and conjunction splits outside parentheses; "5,2" stays whole. */
const splitItems = (sentence: Span): Span[] => {
	const cuts: [number, number][] = [];
	let depth = 0;
	for (let index = 0; index < sentence.text.length; index += 1) {
		const character = sentence.text[index];
		depth = Math.max(0, depth + (character === "(" ? 1 : 0) - (character === ")" ? 1 : 0));
		if (depth) {
			continue;
		}
		const separator = /^(?:[,;]\s+(?=\D)|\s+(?:und|sowie|oder)\s+)/u.exec(
			sentence.text.slice(index),
		);
		if (separator) {
			cuts.push([index, index + separator[0].length]);
			index += separator[0].length - 1;
		}
	}
	const items: Span[] = [];
	let from = 0;
	for (const [cut, next] of [...cuts, [sentence.text.length, sentence.text.length]]) {
		const item = trimSpan(
			sentence.text.slice(from, cut).replace(/[.;]\s*$/u, ""),
			sentence.start + from,
		);
		if (item) {
			items.push(item);
		}
		from = next;
	}
	return items;
};

/**
 * Facts of free markdown: each sentence split into items at commas, "und" and
 * "sowie". Headings, labels ending in ":", bold-only lines, [filler] and lines
 * with Markdoc tags (covered by value claims, or already cited) are skipped.
 */
export const textClaims = (markdown: string): Omit<Claim, "id">[] => {
	const claims: Omit<Claim, "id">[] = [];
	let offset = 0;
	for (const line of markdown.split("\n")) {
		const start = offset;
		offset += line.length + 1;
		const prefix = /^\s*(?:[-*+]\s+|\d+\.\s+)?/u.exec(line)?.[0] ?? "";
		const body = line.slice(prefix.length).trim();
		if (
			!body ||
			/^\s*#/u.test(line) ||
			body.endsWith(":") ||
			/^\[.*\]$/u.test(body) ||
			/^\*\*[^*]+\*\*:?$/u.test(body) ||
			body.includes("{%")
		) {
			continue;
		}
		for (const sentence of splitSentences(line.slice(prefix.length), start + prefix.length)) {
			for (const item of splitItems(sentence)) {
				claims.push({
					checked: item.text,
					context: sentence.text,
					target: { end: item.end, kind: "span", start: item.start },
					text: item.text,
				});
			}
		}
	}
	return claims;
};

const formatValue = (value: unknown): string => {
	if (typeof value === "boolean") {
		return value ? "ja" : "nein";
	}
	if (typeof value === "number") {
		return String(value).replace(".", ",");
	}
	return Array.isArray(value) ? value.map(formatValue).join(", ") : String(value);
};

/** A fillable field: a template variable, or an autofill input field. */
export interface ValueField {
	description?: string;
	name: string;
	unit?: string;
}

/** User-filled fields and selectors of a template; calculated values are arithmetic, not documented facts. */
export const templateFields = (template: string): ValueField[] =>
	analyzeMarkdocTemplate(template).variables.flatMap(({ description, name, roles, unit }) =>
		roles.field || roles.selector ? [{ description, name, unit }] : [],
	);

/** Facts of filled fields: every non-empty value, described by its name, description and unit. */
export const valueClaims = (
	fields: readonly ValueField[],
	values: Readonly<Record<string, unknown>>,
): Omit<Claim, "id">[] =>
	fields.flatMap(({ description, name, unit }) => {
		const value = values[name];
		if (
			value === undefined ||
			value === null ||
			value === "" ||
			(Array.isArray(value) && !value.length)
		) {
			return [];
		}
		const formatted = `${formatValue(value)}${unit ? ` ${unit}` : ""}`;
		const label = description ? `${name} (${description})` : name;
		return [
			{
				checked: formatValue(value),
				context: `Template field «${label}»`,
				target: { key: name, kind: "value" as const },
				text: `${label}: ${formatted}`,
			},
		];
	});
