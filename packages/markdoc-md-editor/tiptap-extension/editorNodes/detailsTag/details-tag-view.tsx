"use client";

import { cn } from "@repo/design-system/lib/utils";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor, NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DEFAULT_DETAILS_SUMMARY } from "markdoc-md/config";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { TAG_COLORS } from "../../../tag-colors";
import { useSelectTagNode } from "../tag-chip";

const SUMMARY_INPUT_SELECTOR = "[data-details-summary]";

/**
 * Focuses the inline summary field of the details section at `pos`, e.g. right
 * after inserting it. The React node view mounts after the transaction, so the
 * lookup waits for the next frame.
 */
export const focusDetailsSummary = (editor: Editor, pos: number) => {
	requestAnimationFrame(() => {
		const dom = editor.view.nodeDOM(pos);
		if (dom instanceof HTMLElement) {
			dom.querySelector<HTMLTextAreaElement>(SUMMARY_INPUT_SELECTOR)?.focus();
		}
	});
};

/**
 * The summary is the section's first line: a disclosure marker followed by an
 * inline text field, typed like any other line of the document. The field wraps
 * like a line of text but holds no line breaks, because the summary is a single
 * attribute value. The body
 * follows in a box attached below. The section is always expanded while
 * editing; the marker shows the rendered default (`open`) and selects the tag
 * for the inspector.
 */
export const DetailsTagView = ({
	editor,
	getPos,
	node,
	selected,
	updateAttributes,
}: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });
	const summary = typeof node.attrs.summary === "string" ? node.attrs.summary : "";
	const Marker = node.attrs.open ? ChevronDown : ChevronRight;
	const summaryRef = useRef<HTMLTextAreaElement>(null);

	// Grow with wrapped text. `field-sizing: content` is not available everywhere.
	// The summary can also change from the inspector, so measure on every value.
	useLayoutEffect(() => {
		const textarea = summaryRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
		// oxlint-disable-next-line react/exhaustive-effect-dependencies -- Re-measure when the text changes.
	}, [summary]);

	const handleMarkerMouseDown = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			// Keep focus in the editor so the node selection stays active/visible.
			event.preventDefault();
			event.stopPropagation();
			handleSelectTag();
		},
		[handleSelectTag],
	);

	const handleMarkerClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			// Keyboard activation has no preceding mousedown.
			if (event.detail === 0) {
				handleSelectTag();
			}
		},
		[handleSelectTag],
	);

	const handleSummaryChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			// Pasted line breaks become spaces; Enter itself moves into the body.
			updateAttributes({ summary: event.target.value.replaceAll(/\s*[\r\n]+\s*/gu, " ") || null });
		},
		[updateAttributes],
	);

	const handleSummaryKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			const pos = getPos?.();
			if (typeof pos !== "number") {
				return;
			}
			const input = event.currentTarget;
			const atEnd = input.selectionStart === input.value.length;
			const atStart = input.selectionEnd === 0;
			// Enter and ArrowDown continue into the body, like leaving a line.
			if (event.key === "Enter" || (event.key === "ArrowDown" && atEnd)) {
				event.preventDefault();
				const { doc } = editor.state;
				editor
					.chain()
					.focus()
					.setTextSelection(TextSelection.near(doc.resolve(pos + 1), 1).from)
					.run();
				return;
			}
			if (event.key === "ArrowUp" && atStart && pos > 0) {
				event.preventDefault();
				const { doc } = editor.state;
				editor
					.chain()
					.focus()
					.setTextSelection(TextSelection.near(doc.resolve(pos), -1).from)
					.run();
			}
		},
		[editor, getPos],
	);

	return (
		<NodeViewWrapper as="div" data-details-tag="" data-type="markdoc-details">
			<div className="flex items-start gap-1" contentEditable={false}>
				<button
					aria-label="Details-Tag bearbeiten"
					title={
						node.attrs.open
							? "Details-Tag bearbeiten (standardmäßig geöffnet)"
							: "Details-Tag bearbeiten (standardmäßig zugeklappt)"
					}
					className={cn(
						"mt-px inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-sm border text-solarized-violet shadow-xs transition-all",
						TAG_COLORS.violet.surface,
						selected ? TAG_COLORS.violet.selected : TAG_COLORS.violet.hover,
					)}
					data-type="markdoc-details"
					onClick={handleMarkerClick}
					onMouseDown={handleMarkerMouseDown}
					type="button"
				>
					<Marker className="size-3.5" />
				</button>
				<textarea
					aria-label="Beschriftung des Details-Abschnitts"
					className="block min-w-0 flex-1 field-sizing-content resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 px-0.5 text-sm leading-[1.45] text-foreground outline-none placeholder:text-muted-foreground placeholder:italic focus:bg-solarized-violet/5"
					data-details-summary=""
					onChange={handleSummaryChange}
					onKeyDown={handleSummaryKeyDown}
					placeholder={`Beschriftung (sonst „${DEFAULT_DETAILS_SUMMARY}“)`}
					ref={summaryRef}
					rows={1}
					spellCheck
					value={summary}
				/>
			</div>
			<NodeViewContent
				className={cn(
					"ml-[9px] flex w-[calc(100%-9px)] flex-col overflow-hidden rounded-md rounded-tl-none border px-2 py-1 whitespace-normal leading-normal",
					TAG_COLORS.violet.surface,
				)}
			/>
		</NodeViewWrapper>
	);
};
