"use client";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

import { CASE_CONDITION_KEYS as operators } from "../tiptap-extension/editorNodes/case-condition";
import type { SwitchCase } from "../tiptap-extension/editorNodes/case-items";
import { ConditionFields } from "./condition-fields";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const reshapeCases = (cases: SwitchCase[], vector: boolean): SwitchCase[] =>
	cases.map((item) => ({
		...item,
		...Object.fromEntries(
			operators.map((key) => {
				const value = item[key];
				if (value === undefined) {
					return [key, undefined];
				}
				if (vector) {
					return [key, Array.isArray(value) ? value : [value ?? null]];
				}
				const scalar = Array.isArray(value) ? value[0] : value;
				return [key, scalar === null ? undefined : scalar];
			}),
		),
	}));

export const ConditionTagPanel = ({
	editor,
	node,
	pos,
}: {
	editor: Editor;
	node: ProseMirrorNode;
	pos: number;
}) => {
	const scalar = !Array.isArray(node.attrs.primary);
	const primary = scalar ? [node.attrs.primary ?? ""] : node.attrs.primary;
	const cases = reshapeCases(Array.isArray(node.attrs.cases) ? node.attrs.cases : [], true);
	const update = (patch: Record<string, unknown>) => {
		const nextPrimary = patch.primary ?? node.attrs.primary;
		const vector = Array.isArray(nextPrimary) && (!scalar || nextPrimary.length > 1);
		if (!vector && Array.isArray(patch.primary)) {
			patch.primary = patch.primary[0] ?? "";
		}
		if (Array.isArray(patch.cases)) {
			patch.cases = reshapeCases(patch.cases as SwitchCase[], vector);
		} else if (vector !== !scalar) {
			patch.cases = reshapeCases(node.attrs.cases, vector);
		}
		if (vector) {
			patch.source = null;
		}
		updateMarkdocTagAttributes(editor, pos, patch);
	};
	// Numeric variables of the document, offered as fields like calc formula variables.
	const available = new Set<string>();
	editor.state.doc.descendants((candidate) => {
		const { primary: name, type } = candidate.attrs;
		if (
			candidate.type.name === "calcTag" ||
			(candidate.type.name === "infoTag" && type === "number")
		) {
			if (typeof name === "string" && name) {
				available.add(name);
			}
		}
		if (candidate.type.name === "conditionTag") {
			for (const member of Array.isArray(name) ? name : [name]) {
				if (typeof member === "string" && member) {
					available.add(member);
				}
			}
		}
	});
	return (
		<ConditionFields
			attributes={node.attrs}
			available={[...available].toSorted()}
			cases={cases}
			primary={primary}
			update={update}
		/>
	);
};
