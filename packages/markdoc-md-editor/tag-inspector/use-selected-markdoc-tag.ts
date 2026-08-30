"use client";

import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";

import { FOCUS_INSERTED_TAG_PRIMARY_META } from "../editor-helpers/select-inserted-inline-tag";

export type MarkdocTagKind = "calcTag" | "caseTag" | "infoTag" | "switchTag";

export interface SelectedMarkdocTag {
	kind: MarkdocTagKind;
	node: ProseMirrorNode;
	pos: number;
	/**
	 * How the tag became selected: as a node selection (chip click) or because
	 * the text cursor sits inside the tag content (case tags only).
	 */
	via: "content" | "node";
	/** Select the primary input when this tag was just inserted from the toolbar. */
	selectPrimary: boolean;
}

const MARKDOC_TAG_NODE_NAMES = new Set<MarkdocTagKind>([
	"calcTag",
	"caseTag",
	"infoTag",
	"switchTag",
]);

const asMarkdocTagKind = (name: string): MarkdocTagKind | null =>
	MARKDOC_TAG_NODE_NAMES.has(name as MarkdocTagKind) ? (name as MarkdocTagKind) : null;

const SHARED_ATTRIBUTES: Record<MarkdocTagKind, ReadonlySet<string>> = {
	calcTag: new Set(["components", "formula", "primary"]),
	caseTag: new Set(),
	infoTag: new Set(["description", "primary", "source", "type", "unit"]),
	switchTag: new Set(["primary", "source", "type"]),
};

interface SharedSwitchCase {
	primary?: unknown;
	value?: unknown;
}

const mergeSharedSwitchCaseValues = (current: unknown, updated: unknown): unknown => {
	if (!Array.isArray(current) || !Array.isArray(updated)) {
		return current;
	}
	const values = new Map(
		(updated as SharedSwitchCase[])
			.filter((caseItem) => typeof caseItem.primary === "string")
			.map((caseItem) => [caseItem.primary as string, caseItem.value]),
	);
	return (current as SharedSwitchCase[]).map((caseItem) =>
		typeof caseItem.primary === "string" && values.has(caseItem.primary)
			? { ...caseItem, value: values.get(caseItem.primary) }
			: caseItem,
	);
};

const mergeSharedCalcComponent = (
	current: Record<string, unknown>,
	updated: Record<string, unknown>,
): Record<string, unknown> => {
	const sharedKeys =
		updated.kind === "info"
			? ["description", "primary", "source", "type", "unit"]
			: ["primary", "source", "type"];
	const sharedAttributes = Object.fromEntries(
		sharedKeys.filter((key) => key in updated).map((key) => [key, updated[key]]),
	);
	const nextComponent = { ...current, ...sharedAttributes };
	if (updated.kind === "switch" && "cases" in updated) {
		nextComponent.cases = mergeSharedSwitchCaseValues(current.cases, updated.cases);
	}
	return nextComponent;
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
	const changedComponents = updatedComponents.flatMap((updated, index) => {
		const old = oldComponents[index];
		return old &&
			(old.kind === "info" || old.kind === "switch") &&
			typeof old.primary === "string" &&
			updated.kind === old.kind
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

	// A text cursor inside a case tag's inline content still selects that case.
	const { $from } = selection;
	const { depth: maxDepth } = $from;
	for (let depth = maxDepth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === "caseTag") {
			return {
				kind: "caseTag",
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
		if (liveTag) {
			editor.commands.setTextSelection(liveTag.pos);
		}
	}, [editor]);

	return { clearSelectedTag, selectedTag: editor ? selectedTag : null };
};

export const updateMarkdocTagAttributesInTransaction = (
	tr: Transaction,
	pos: number,
	attributes: Record<string, unknown>,
): boolean => {
	const node = tr.doc.nodeAt(pos);
	const kind = node ? asMarkdocTagKind(node.type.name) : null;
	if (!node || !kind) {
		return false;
	}
	const oldPrimary = node.attrs.primary;
	const sharedAttributes = Object.fromEntries(
		Object.entries(attributes).filter(([attribute]) => SHARED_ATTRIBUTES[kind].has(attribute)),
	);
	const peerPositions: number[] = [];
	if (typeof oldPrimary === "string" && oldPrimary) {
		tr.doc.descendants((candidate, candidatePos) => {
			if (
				candidatePos !== pos &&
				candidate.type.name === kind &&
				candidate.attrs.primary === oldPrimary
			) {
				peerPositions.push(candidatePos);
			}
		});
	}
	for (const peerPos of peerPositions) {
		const peer = tr.doc.nodeAt(peerPos);
		if (!peer) {
			continue;
		}
		const nextAttributes = { ...peer.attrs, ...sharedAttributes };
		if (kind === "switchTag" && "cases" in attributes) {
			nextAttributes.cases = mergeSharedSwitchCaseValues(peer.attrs.cases, attributes.cases);
		}
		tr.setNodeMarkup(peerPos, undefined, nextAttributes);
	}
	if ((kind === "infoTag" || kind === "switchTag") && typeof oldPrimary === "string") {
		const componentKind = kind === "infoTag" ? "info" : "switch";
		const calcUpdates: { components: Record<string, unknown>[]; pos: number }[] = [];
		tr.doc.descendants((candidate, candidatePos) => {
			if (candidate.type.name !== "calcTag" || !Array.isArray(candidate.attrs.components)) {
				return;
			}
			let changed = false;
			const components = (candidate.attrs.components as Record<string, unknown>[]).map(
				(component) => {
					if (component.kind !== componentKind || component.primary !== oldPrimary) {
						return component;
					}
					changed = true;
					const nextComponent = { ...component, ...sharedAttributes };
					if (kind === "switchTag" && "cases" in attributes) {
						nextComponent.cases = mergeSharedSwitchCaseValues(component.cases, attributes.cases);
					}
					return nextComponent;
				},
			);
			if (changed) {
				calcUpdates.push({ components, pos: candidatePos });
			}
		});
		for (const calcUpdate of calcUpdates) {
			const calc = tr.doc.nodeAt(calcUpdate.pos);
			if (calc) {
				tr.setNodeMarkup(calcUpdate.pos, undefined, {
					...calc.attrs,
					components: calcUpdate.components,
				});
			}
		}
	}
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
	// Replacing the node degrades its NodeSelection to a text selection,
	// which would drop the chip highlight — restore it.
	if (hadNodeSelection) {
		tr.setSelection(NodeSelection.create(tr.doc, pos));
	}
	return true;
};

export const updateMarkdocTagAttributes = (
	editor: Editor,
	pos: number,
	attributes: Record<string, unknown>,
): void => {
	// No .focus() here: the caller usually types in an inspector input and must
	// keep focus there while the node attributes update underneath.
	editor
		.chain()
		.command(({ tr }) => updateMarkdocTagAttributesInTransaction(tr, pos, attributes))
		.run();
};
