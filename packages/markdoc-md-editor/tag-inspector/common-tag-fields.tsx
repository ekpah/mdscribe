"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Node } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { MarkdocTagKind } from "./use-selected-markdoc-tag";
import { renameMarkdocVariable, updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

/** Whether another tag than the one at `pos` already declares `name`. */
const isNameUsedElsewhere = (editor: Editor, name: string, pos: number): boolean => {
	let used = false;
	editor.state.doc.descendants((candidate, candidatePos) => {
		if (used) {
			return false;
		}
		if (candidatePos !== pos && candidate.attrs.primary === name) {
			used = true;
		}
		const components: unknown = candidate.attrs.components;
		if (Array.isArray(components) && components.some((component) => component.primary === name)) {
			used = true;
		}
		return !used;
	});
	return used;
};

/** Shared variable identity, in the same order for every value-producing tag. */
export const CommonTagFields = ({
	editor,
	node,
	pos,
	selectPrimary = false,
}: {
	editor: Editor;
	node: Node;
	pos: number;
	selectPrimary?: boolean;
}) => {
	const id = useId();
	const primaryRef = useRef<HTMLInputElement>(null);
	// A rename applies to the whole variable when editing the name ends. While
	// typing, only this tag changes, so an intermediate name (e.g. "LV" on the way
	// to "LVEF") never merges with another variable. An empty name stays a local
	// draft and reverts if editing ends empty.
	const [primaryDraft, setPrimaryDraft] = useState<"" | null>(null);
	const [renameFrom, setRenameFrom] = useState<string | null>(null);
	/** The rename being typed, kept independent of later props for commit on unmount. */
	const pending = useRef<{
		editor: Editor;
		from: string;
		kind: MarkdocTagKind;
		pos: number;
		/** The last non-empty name typed, or null while the field is empty. */
		to: string | null;
	} | null>(null);
	const commitRename = useCallback(() => {
		const rename = pending.current;
		pending.current = null;
		setPrimaryDraft(null);
		setRenameFrom(null);
		if (!rename || rename.editor.isDestroyed) {
			return;
		}
		if (rename.to === null) {
			// Editing ended with an empty name: keep the variable's name.
			updateMarkdocTagAttributes(
				rename.editor,
				rename.pos,
				{ primary: rename.from },
				{ share: false },
			);
			return;
		}
		renameMarkdocVariable(rename.editor, rename.kind, rename.from, rename.to);
	}, []);
	// Leaving the tag (or closing the inspector) also ends editing.
	useEffect(() => commitRename, [pos, commitRename]);
	useEffect(() => {
		if (selectPrimary) {
			primaryRef.current?.focus();
			primaryRef.current?.select();
		}
	}, [selectPrimary]);
	const nameTaken =
		renameFrom !== null &&
		typeof node.attrs.primary === "string" &&
		node.attrs.primary !== renameFrom &&
		isNameUsedElsewhere(editor, node.attrs.primary, pos);
	return (
		<div className="space-y-3">
			{(
				[
					["primary", "Variablenname", "z.B. Herzfrequenz"],
					["description", "Beschreibung (optional)", "Hinweis für das Ausfüllen"],
					["source", "Quelle (optional)", "z.B. fhir://Observation..."],
					["unit", "Einheit (optional)", "z.B. kg, mmHg"],
				] as const
			).map(([attribute, label, placeholder]) => (
				<div className="space-y-1.5" key={attribute}>
					<Label className="font-medium text-xs" htmlFor={`${id}-${attribute}`}>
						{label}
					</Label>
					<Input
						className="h-8 text-sm"
						id={`${id}-${attribute}`}
						ref={attribute === "primary" ? primaryRef : undefined}
						placeholder={placeholder}
						value={
							attribute === "primary" && primaryDraft !== null
								? primaryDraft
								: node.attrs[attribute] || ""
						}
						onBlur={attribute === "primary" ? commitRename : undefined}
						onKeyDown={
							attribute === "primary"
								? (event) => {
										if (event.key === "Enter") {
											commitRename();
										}
									}
								: undefined
						}
						onChange={(event) => {
							const { value } = event.target;
							if (attribute !== "primary") {
								updateMarkdocTagAttributes(editor, pos, { [attribute]: value || null });
								return;
							}
							if (!pending.current && typeof node.attrs.primary === "string") {
								pending.current = {
									editor,
									from: node.attrs.primary,
									kind: node.type.name as MarkdocTagKind,
									pos,
									to: null,
								};
								setRenameFrom(node.attrs.primary);
							}
							if (pending.current) {
								pending.current.to = value || null;
							}
							setPrimaryDraft(value ? null : "");
							if (value) {
								updateMarkdocTagAttributes(editor, pos, { primary: value }, { share: false });
							}
						}}
					/>
					{attribute === "primary" && nameTaken && (
						<p className="text-muted-foreground text-xs">
							„{node.attrs.primary}“ wird schon verwendet. Beim Verlassen des Feldes werden beide zu
							einer Variable zusammengeführt.
						</p>
					)}
				</div>
			))}
		</div>
	);
};
