"use client";

import { cn } from "@repo/design-system/lib/utils";
import { NodeSelection } from "@tiptap/pm/state";
import type { NodeViewProps } from "@tiptap/react";
import type { MouseEvent, ReactNode } from "react";
import { useCallback } from "react";

import { TAG_COLORS } from "../../tag-colors";

/**
 * Selects the node view's node in the editor, which surfaces its properties
 * in the tag inspector sidebar/sheet.
 */
export const useSelectTagNode = ({ editor, getPos }: Pick<NodeViewProps, "editor" | "getPos">) =>
	useCallback(() => {
		const pos = getPos?.();
		if (typeof pos === "number") {
			// Focus first so ProseMirror writes the NodeSelection into the browser
			// selection instead of leaving the previously focused text range visible.
			editor.view.focus();
			editor.view.dispatch(
				editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)),
			);
		}
	}, [editor, getPos]);

export const TagChip = ({
	children,
	color,
	dataType,
	label,
	onSelect,
	selected,
	summary,
}: {
	/** Extra inline content outside the select trigger (e.g. editable case content). */
	children?: ReactNode;
	color: keyof typeof TAG_COLORS;
	dataType: string;
	label: string;
	onSelect: () => void;
	selected: boolean;
	/** Compact value preview rendered next to the label. */
	summary?: ReactNode;
}) => {
	const colorClasses = TAG_COLORS[color];

	const handleMouseDown = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			// Keep focus in the editor so the node selection stays active/visible.
			event.preventDefault();
			event.stopPropagation();
			onSelect();
		},
		[onSelect],
	);

	const handleClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			// A click is dispatched after the handled mousedown and must not reach
			// ProseMirror, where it can replace the node selection with a caret.
			event.preventDefault();
			event.stopPropagation();
			// Keyboard activation has no preceding mousedown.
			if (event.detail === 0) {
				onSelect();
			}
		},
		[onSelect],
	);

	return (
		<span
			className={cn(
				"group inline-flex select-none items-center gap-0.5 rounded-sm border px-1 py-0 text-[11px] leading-none shadow-xs transition-all",
				colorClasses.surface,
				selected ? colorClasses.selected : colorClasses.hover,
			)}
		>
			<button
				aria-label={`${label}-Tag bearbeiten`}
				title={`${label}-Tag bearbeiten`}
				className="inline-flex h-[18px] cursor-pointer items-center gap-1 px-0.5 py-0 leading-none"
				contentEditable={false}
				data-type={dataType}
				onClick={handleClick}
				onMouseDown={handleMouseDown}
				type="button"
			>
				{summary}
			</button>

			{children}
		</span>
	);
};
