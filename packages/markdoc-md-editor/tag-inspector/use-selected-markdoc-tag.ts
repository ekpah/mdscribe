"use client";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { renameFormulaVariable } from "markdoc-md/parse";
import { useCallback, useEffect, useRef, useState } from "react";

import { mapNestedTagAttributes } from "../editor-helpers/nested-tag-attributes";
import { FOCUS_INSERTED_TAG_PRIMARY_META } from "../editor-helpers/select-inserted-inline-tag";
import { normalizeBooleanSwitchCases } from "../tiptap-extension/editorNodes/switchTag/switch-tag";

const CLEAR_SELECTED_TAG_META = "markdoc-clear-selected-tag";

export type MarkdocTagKind =
	| "calcTag"
	| "caseTag"
	| "conditionTag"
	| "detailsTag"
	| "infoTag"
	| "switchTag";

export interface SelectedMarkdocTag {
	kind: MarkdocTagKind;
	node: ProseMirrorNode;
	pos: number;
	/**
	 * How the tag became selected: as a node selection (chip click) or because
	 * the text cursor sits inside the tag content (case and details tags).
	 */
	via: "content" | "node";
	/** Select the primary input when this tag was just inserted from the toolbar. */
	selectPrimary: boolean;
}

const MARKDOC_TAG_NODE_NAMES = new Set<MarkdocTagKind>([
	"calcTag",
	"caseTag",
	"conditionTag",
	"detailsTag",
	"infoTag",
	"switchTag",
]);

const asMarkdocTagKind = (name: string): MarkdocTagKind | null =>
	MARKDOC_TAG_NODE_NAMES.has(name as MarkdocTagKind) ? (name as MarkdocTagKind) : null;

const SHARED_ATTRIBUTES: Record<MarkdocTagKind, ReadonlySet<string>> = {
	calcTag: new Set(["components", "description", "formula", "primary", "source", "unit"]),
	caseTag: new Set(),
	// A condition only references variables; its member names and group
	// metadata are local to each occurrence.
	conditionTag: new Set(),
	// A details section has no shared variable identity; label and default
	// state are local to each occurrence.
	detailsTag: new Set(),
	infoTag: new Set(["description", "primary", "source", "type", "unit"]),
	switchTag: new Set(["description", "primary", "source", "type", "unit"]),
};

/**
 * Applies a visitor to every tag in the document: editor nodes, calc
 * components, and tags inside case content.
 */
const mapAllTagAttributes = (
	tr: Transaction,
	visit: (kind: string, attrs: Record<string, any>) => Record<string, any>,
): void => {
	tr.doc.descendants((node, pos) => {
		const attrs = mapNestedTagAttributes(node.type.name, node.attrs, visit);
		if (attrs !== node.attrs) {
			tr.setNodeMarkup(pos, undefined, attrs);
		}
	});
};

export const SHARED_TAG_EDITS_META = "markdoc-shared-tag-edits";

/** A change to one variable's shared settings, possibly including its name. */
export interface SharedTagEdit {
	attributes: Record<string, unknown>;
	kind: MarkdocTagKind;
	/** The variable's name before the edit. */
	primary: string;
}

/** Edits made in a nested case editor that the root document must apply too. */
interface ForwardedEdits {
	sharedCaseEdits?: SharedCaseEdit[];
	sharedTagEdits?: SharedTagEdit[];
}

/**
 * Gives every mention of the variable the shared settings: editor nodes, calc
 * components, and tags inside case content. A rename also updates the calc
 * formulas and conditions that reference the variable.
 */
const applySharedTagEdit = (tr: Transaction, { attributes, kind, primary }: SharedTagEdit) => {
	mapAllTagAttributes(tr, (candidateKind, attrs) =>
		candidateKind === kind &&
		attrs.primary === primary &&
		Object.entries(attributes).some(([key, value]) => !Object.is(attrs[key] ?? null, value ?? null))
			? withSharedSwitchType(attrs, attributes)
			: attrs,
	);
	const renamed = attributes.primary;
	if (VARIABLE_KINDS.has(kind) && typeof renamed === "string" && renamed && renamed !== primary) {
		renameVariableReferences(tr, primary, renamed);
	}
};

/**
 * Renames a variable everywhere at once: all its declarations, calc formulas,
 * and condition fields. Inspector name fields call this when editing ends, so
 * intermediate names while typing never merge with another variable.
 */
export const renameMarkdocVariable = (
	editor: Editor,
	kind: MarkdocTagKind,
	from: string,
	to: string,
): void => {
	if (!from || !to || from === to) {
		return;
	}
	editor
		.chain()
		.command(({ tr }) => {
			const edit: SharedTagEdit = { attributes: { primary: to }, kind, primary: from };
			applySharedTagEdit(tr, edit);
			tr.setMeta(SHARED_TAG_EDITS_META, [edit]);
			return true;
		})
		.run();
};

/** Tags whose primary names a variable that formulas and conditions can reference. */
const VARIABLE_KINDS = new Set<MarkdocTagKind>(["calcTag", "infoTag", "switchTag"]);

/** Points calc formulas and condition fields at a renamed variable, wherever they are. */
const renameVariableReferences = (tr: Transaction, from: string, to: string): void => {
	const rename = (name: unknown) => (name === from ? to : name);
	mapAllTagAttributes(tr, (kind, attrs) => {
		let next = attrs;
		// Every declaration of the variable, whatever its tag kind (e.g. an info
		// showing a renamed calc, or a calc's component for it).
		if (VARIABLE_KINDS.has(kind as MarkdocTagKind) && attrs.primary === from) {
			next = { ...next, primary: to };
		}
		if (kind === "calcTag" && typeof next.formula === "string") {
			const formula = renameFormulaVariable(next.formula, from, to);
			if (formula !== next.formula) {
				next = { ...next, formula };
			}
		}
		if (kind === "conditionTag") {
			const primary = Array.isArray(attrs.primary)
				? attrs.primary.map(rename)
				: rename(attrs.primary);
			if (JSON.stringify(primary) !== JSON.stringify(attrs.primary)) {
				next = { ...next, primary };
			}
		}
		return next;
	});
};

/** Case attributes shared by every case with the same switch primary and option key. */
const SHARED_CASE_ATTRIBUTES = ["value"] as const;

type CaseItem = Record<string, unknown>;
type CasePatches = Record<string, CaseItem>;

const asCases = (cases: unknown): CaseItem[] => (Array.isArray(cases) ? cases : []);
const isSharedCase = (item: CaseItem): item is CaseItem & { primary: string } =>
	typeof item.primary === "string" && item.primary !== "" && !item.isDefault;

/**
 * Gives every switch case an explicit copy of its option's shared mapping
 * from any other occurrence, so each occurrence shows and edits the value it
 * uses. Conflicting explicit values stay for validation to report.
 */
export const ensureSharedSwitchCaseAttributes = (
	tr: Transaction,
	rootDocument: ProseMirrorNode = tr.doc,
): boolean => {
	const mappings = new Map<unknown, Map<string, CaseItem>>();
	// A nested case editor also inherits from the complete document.
	const documents = rootDocument === tr.doc ? [tr.doc] : [tr.doc, rootDocument];
	for (const doc of documents) {
		doc.descendants((node) => {
			mapNestedTagAttributes(node.type.name, node.attrs, (kind, attrs) => {
				if (kind !== "switchTag" || typeof attrs.primary !== "string") {
					return attrs;
				}
				const options = mappings.get(attrs.primary) ?? new Map<string, CaseItem>();
				mappings.set(attrs.primary, options);
				for (const item of asCases(attrs.cases).filter(isSharedCase)) {
					const shared = options.get(item.primary) ?? {};
					for (const key of SHARED_CASE_ATTRIBUTES) {
						if (item[key] != null) {
							shared[key] = item[key];
						}
					}
					options.set(item.primary, shared);
				}
				return attrs;
			});
		});
	}
	const inherit = (kind: string, attrs: CaseItem): CaseItem => {
		const options = kind === "switchTag" ? mappings.get(attrs.primary) : undefined;
		if (!options) {
			return attrs;
		}
		const cases = applyCasePatches(attrs.cases, Object.fromEntries(options), true);
		return cases === attrs.cases ? attrs : { ...attrs, cases };
	};
	const steps = tr.steps.length;
	mapAllTagAttributes(tr, inherit);
	return tr.steps.length !== steps;
};

/** Shared case attributes that changed between two versions of a switch's cases, by option key. */
const diffSharedCases = (previous: unknown, next: unknown): CasePatches => {
	const previousCases = asCases(previous);
	const nextCases = asCases(next);
	const before = new Map(previousCases.map((item) => [item.primary, item]));
	const patches: CasePatches = {};
	for (const [index, item] of nextCases.entries()) {
		if (!isSharedCase(item)) {
			continue;
		}
		// Renaming an option in place keeps its value; it must not overwrite the
		// value another occurrence has for the new name.
		const renamed =
			previousCases.length === nextCases.length && previousCases[index]?.primary !== item.primary;
		if (renamed) {
			continue;
		}
		const patch = Object.fromEntries(
			SHARED_CASE_ATTRIBUTES.filter(
				(key) => !Object.is(item[key], before.get(item.primary)?.[key]),
			).map((key) => [key, item[key]]),
		);
		if (Object.keys(patch).length > 0) {
			patches[item.primary] = patch;
		}
	}
	return patches;
};

/**
 * Applies shared case patches by option key, returning the original array when
 * nothing changes. `fillOnly` only sets attributes a case does not define.
 */
const applyCasePatches = (cases: unknown, patches: CasePatches, fillOnly = false): unknown => {
	if (!Array.isArray(cases)) {
		return cases;
	}
	let changed = false;
	const next = cases.map((item: CaseItem) => {
		const patch = isSharedCase(item) ? patches[item.primary] : undefined;
		const entries = Object.entries(patch ?? {}).filter(
			([key, value]) =>
				(fillOnly ? item[key] == null && value != null : true) && !Object.is(item[key], value),
		);
		if (entries.length === 0) {
			return item;
		}
		changed = true;
		return { ...item, ...Object.fromEntries(entries) };
	});
	return changed ? next : cases;
};

export const SHARED_CASE_EDITS_META = "markdoc-shared-case-edits";

/** Shared case changes made to one switch, applied to every switch with that primary. */
export interface SharedCaseEdit {
	primary: string;
	patches: CasePatches;
}

/**
 * Shared case edits a tag update makes: to the switch itself or to a calc's
 * switch components. Only inspector edits carry mapping intent; replacing
 * nested content arrives as forwarded edits from the nested editor instead.
 */
const sharedCaseEditsOf = (node: ProseMirrorNode, updated: CaseItem): SharedCaseEdit[] => {
	const switchesOf = (attrs: CaseItem): CaseItem[] =>
		node.type.name === "switchTag"
			? [attrs]
			: node.type.name === "calcTag"
				? asCases(attrs.components).filter((component) => component.kind === "switch")
				: [];
	const before = new Map(switchesOf(node.attrs).map((attrs) => [attrs.primary, attrs]));
	return switchesOf(updated).flatMap((attrs) => {
		const old = before.get(attrs.primary);
		if (typeof attrs.primary !== "string" || !old) {
			return [];
		}
		const patches = diffSharedCases(old.cases, attrs.cases);
		return Object.keys(patches).length > 0 ? [{ patches, primary: attrs.primary }] : [];
	});
};

/** Applies shared case edits to every switch: nodes, calc components, and nested case content. */
const spreadSharedCaseEdits = (tr: Transaction, edits: SharedCaseEdit[]): void => {
	if (edits.length === 0) {
		return;
	}
	tr.setMeta(SHARED_CASE_EDITS_META, edits);
	mapAllTagAttributes(tr, (kind, current) => {
		if (kind !== "switchTag") {
			return current;
		}
		let { cases } = current;
		for (const edit of edits) {
			if (edit.primary === current.primary) {
				cases = applyCasePatches(cases, edit.patches);
			}
		}
		return cases === current.cases ? current : { ...current, cases };
	});
};

/** Applies shared attributes; a switch that becomes a checkbox also gets true/false options. */
const withSharedSwitchType = (
	attrs: Record<string, unknown>,
	shared: Record<string, unknown>,
): Record<string, unknown> =>
	shared.type === "boolean" && attrs.type !== "boolean"
		? {
				...attrs,
				...shared,
				cases: normalizeBooleanSwitchCases(Array.isArray(attrs.cases) ? attrs.cases : []),
			}
		: { ...attrs, ...shared };

/** Shared component attributes; switch case mappings spread separately. */
const mergeSharedCalcComponent = (
	current: Record<string, unknown>,
	updated: Record<string, unknown>,
): Record<string, unknown> => {
	const sharedKeys =
		updated.kind === "info"
			? ["description", "primary", "source", "type", "unit"]
			: ["primary", "source", "type"];
	return {
		...current,
		...Object.fromEntries(
			sharedKeys.filter((key) => key in updated).map((key) => [key, updated[key]]),
		),
	};
};

const synchronizeCalcComponents = ({
	node,
	oldPrimary,
	pos,
	tr,
	updatedComponents,
}: {
	node: ProseMirrorNode;
	oldPrimary: unknown;
	pos: number;
	tr: Transaction;
	updatedComponents: Record<string, unknown>[];
}): void => {
	const oldComponents = Array.isArray(node.attrs.components)
		? (node.attrs.components as Record<string, unknown>[])
		: [];
	// Pair components by kind and name: a formula edit can add or remove
	// components, which must never pair unrelated declarations.
	const changedComponents = updatedComponents.flatMap((updated) => {
		const old = oldComponents.find(
			(candidate) => candidate.kind === updated.kind && candidate.primary === updated.primary,
		);
		return old && (old.kind === "info" || old.kind === "switch") && typeof old.primary === "string"
			? [{ old, updated }]
			: [];
	});
	const updates: { attrs: Record<string, unknown>; pos: number }[] = [];
	tr.doc.descendants((candidate, candidatePos) => {
		const matchingComponent = changedComponents.find(({ old }) => {
			const nodeType = old.kind === "info" ? "infoTag" : "switchTag";
			return candidate.type.name === nodeType && candidate.attrs.primary === old.primary;
		});
		if (matchingComponent) {
			updates.push({
				attrs: mergeSharedCalcComponent(candidate.attrs, matchingComponent.updated),
				pos: candidatePos,
			});
			return;
		}
		if (
			candidatePos !== pos &&
			candidate.type.name === "calcTag" &&
			candidate.attrs.primary !== oldPrimary &&
			Array.isArray(candidate.attrs.components)
		) {
			let changed = false;
			const components = (candidate.attrs.components as Record<string, unknown>[]).map(
				(component) => {
					const matching = changedComponents.find(
						({ old }) => component.kind === old.kind && component.primary === old.primary,
					);
					if (!matching) {
						return component;
					}
					changed = true;
					return mergeSharedCalcComponent(component, matching.updated);
				},
			);
			if (changed) {
				updates.push({ attrs: { ...candidate.attrs, components }, pos: candidatePos });
			}
		}
	});
	for (const update of updates) {
		tr.setNodeMarkup(update.pos, undefined, update.attrs);
	}
};

const readSelectedTag = (editor: Editor, selectPrimary = false): SelectedMarkdocTag | null => {
	const { selection } = editor.state;

	if (selection instanceof NodeSelection) {
		const kind = asMarkdocTagKind(selection.node.type.name);
		if (kind) {
			return {
				kind,
				node: selection.node,
				pos: selection.from,
				selectPrimary,
				via: "node",
			};
		}
	}

	// A text cursor inside a case tag's inline content or a details block's
	// content still selects that tag, so the inspector follows the caret.
	const { $from } = selection;
	const { depth: maxDepth } = $from;
	for (let depth = maxDepth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === "caseTag" || node.type.name === "detailsTag") {
			return {
				kind: node.type.name,
				node,
				pos: $from.before(depth),
				selectPrimary,
				via: "content",
			};
		}
	}

	return null;
};

/**
 * Tracks the tag shown in the inspector. Sticky: once a tag is selected it
 * stays active while the selection moves elsewhere (e.g. typing in the
 * document) until another tag is selected, the tag is deleted, or
 * `clearSelectedTag` is called (X button / sheet dismiss).
 */
export const useSelectedMarkdocTag = (
	editor: Editor | null,
): { clearSelectedTag: () => void; selectedTag: SelectedMarkdocTag | null } => {
	const [selectedTag, setSelectedTag] = useState<SelectedMarkdocTag | null>(null);
	const dismissedSelectionRef = useRef<{ from: number; to: number } | null>(null);

	useEffect(() => {
		if (!editor) {
			setSelectedTag(null);
			return;
		}

		setSelectedTag(readSelectedTag(editor));

		const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (editor.isDestroyed) {
				setSelectedTag(null);
				return;
			}
			if (transaction.getMeta(CLEAR_SELECTED_TAG_META) === true) {
				setSelectedTag(null);
				return;
			}
			const dismissedSelection = dismissedSelectionRef.current;
			if (
				dismissedSelection &&
				!transaction.selectionSet &&
				editor.state.selection.from === dismissedSelection.from &&
				editor.state.selection.to === dismissedSelection.to
			) {
				setSelectedTag(null);
				return;
			}
			dismissedSelectionRef.current = null;

			const requestsPrimarySelection =
				transaction.getMeta(FOCUS_INSERTED_TAG_PRIMARY_META) === true;
			const liveTag = readSelectedTag(editor, requestsPrimarySelection);
			if (liveTag) {
				setSelectedTag((previous) => ({
					...liveTag,
					selectPrimary:
						requestsPrimarySelection ||
						Boolean(
							previous?.selectPrimary &&
							previous.kind === liveTag.kind &&
							transaction.mapping.map(previous.pos) === liveTag.pos,
						),
				}));
				return;
			}

			// Selection moved off the tag: keep the last tag active while it
			// still exists, remapping its position through this transaction.
			setSelectedTag((previous) => {
				if (!previous) {
					return null;
				}
				const mappedPos = transaction.mapping.map(previous.pos);
				const node = editor.state.doc.nodeAt(mappedPos);
				if (node && node.type.name === previous.kind) {
					return {
						kind: previous.kind,
						node,
						pos: mappedPos,
						selectPrimary: false,
						via: previous.via,
					};
				}
				return null;
			});
		};

		editor.on("transaction", handleTransaction);

		return () => {
			editor.off("transaction", handleTransaction);
		};
	}, [editor]);

	const clearSelectedTag = useCallback(() => {
		setSelectedTag(null);

		if (!editor || editor.isDestroyed) {
			return;
		}

		// Collapse an active tag selection so the next transaction does not
		// immediately re-activate the tag.
		const liveTag = readSelectedTag(editor);
		if (!liveTag) {
			return;
		}

		const { doc } = editor.state;
		const dismissAt = (selection: Selection) => {
			dismissedSelectionRef.current = { from: selection.from, to: selection.to };
			editor.view.dispatch(
				editor.state.tr.setMeta(CLEAR_SELECTED_TAG_META, true).setSelection(selection),
			);
		};
		if (doc.resolve(liveTag.pos).parent.inlineContent) {
			dismissAt(TextSelection.create(doc, liveTag.pos));
			return;
		}

		// Block tags (details) are not inline content: place the caret after the
		// section instead of requesting a text selection at a doc-level position.
		dismissAt(Selection.near(doc.resolve(liveTag.pos + liveTag.node.nodeSize), 1));
	}, [editor]);

	return { clearSelectedTag, selectedTag: editor ? selectedTag : null };
};

export const updateMarkdocTagAttributesInTransaction = (
	tr: Transaction,
	pos: number,
	attributes: Record<string, unknown>,
	{
		share = true,
		sharedCaseEdits = [],
		sharedTagEdits = [],
	}: ForwardedEdits & { share?: boolean } = {},
): boolean => {
	const node = tr.doc.nodeAt(pos);
	const kind = node ? asMarkdocTagKind(node.type.name) : null;
	if (!node || !kind) {
		return false;
	}
	const oldPrimary = node.attrs.primary;
	// Condition components keep their member references local to one calc.
	const hasConditionComponents = (components: unknown): boolean =>
		Array.isArray(components) && components.some((component) => component.kind === "condition");
	const sharedAttributes = Object.fromEntries(
		Object.entries(attributes).filter(
			([attribute]) =>
				SHARED_ATTRIBUTES[kind].has(attribute) &&
				!(
					attribute === "components" &&
					(hasConditionComponents(node.attrs.components) ||
						hasConditionComponents(attributes.components))
				),
		),
	);
	const sharesAttributes =
		share &&
		Object.keys(sharedAttributes).length > 0 &&
		typeof oldPrimary === "string" &&
		oldPrimary !== "";
	if (kind === "calcTag" && Array.isArray(attributes.components)) {
		synchronizeCalcComponents({
			node,
			oldPrimary,
			pos,
			tr,
			updatedComponents: attributes.components as Record<string, unknown>[],
		});
	}

	const hadNodeSelection = tr.selection instanceof NodeSelection && tr.selection.from === pos;
	tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attributes });
	const tagEdits: SharedTagEdit[] = [
		...sharedTagEdits,
		...(sharesAttributes
			? [{ attributes: sharedAttributes, kind, primary: oldPrimary as string }]
			: []),
	];
	for (const edit of tagEdits) {
		applySharedTagEdit(tr, edit);
	}
	if (tagEdits.length > 0) {
		tr.setMeta(SHARED_TAG_EDITS_META, tagEdits);
	}
	spreadSharedCaseEdits(tr, [
		...sharedCaseEdits,
		...sharedCaseEditsOf(node, { ...node.attrs, ...attributes }),
	]);
	// Replacing the node degrades its NodeSelection to a text selection,
	// which would drop the chip highlight — restore it.
	if (hadNodeSelection) {
		tr.setSelection(NodeSelection.create(tr.doc, pos));
	}
	return true;
};

/** How a nested case editor's change reaches the tag that owns the case. */
export interface NestedContentUpdate extends ForwardedEdits {
	/** False to change only this tag, not the other mentions of its variable. */
	share?: boolean;
	/** False for automatic normalization, which must not become an undo step. */
	addToHistory?: boolean;
}

export const updateMarkdocTagAttributes = (
	editor: Editor,
	pos: number,
	attributes: Record<string, unknown>,
	{ addToHistory = true, ...forwarded }: NestedContentUpdate = {},
): void => {
	// No .focus() here: the caller usually types in an inspector input and must
	// keep focus there while the node attributes update underneath.
	editor
		.chain()
		.command(({ tr }) => {
			if (!addToHistory) {
				tr.setMeta("addToHistory", false);
			}
			return updateMarkdocTagAttributesInTransaction(tr, pos, attributes, forwarded);
		})
		.run();
};
