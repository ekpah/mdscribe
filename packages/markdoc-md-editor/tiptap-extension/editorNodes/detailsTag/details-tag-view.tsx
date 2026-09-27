"use client";

import { cn } from "@repo/design-system/lib/utils";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { DEFAULT_DETAILS_SUMMARY } from "markdoc-md/config";

import { TAG_COLORS } from "../../../tag-colors";
import { TagChip, useSelectTagNode } from "../tag-chip";

/**
 * Mirrors the expanded switch layout: the summary chip sits on top and the
 * content follows inline in a box attached to the chip's bottom-right corner.
 * The label is authored in the inspector; the section is always expanded while
 * editing, and `open` only decides the rendered default.
 */
export const DetailsTagView = ({ editor, getPos, node, selected }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });
	const summary = typeof node.attrs.summary === "string" ? node.attrs.summary.trim() : "";

	return (
		<NodeViewWrapper as="div" className="my-2" data-details-tag="" data-type="markdoc-details">
			<div className="flex items-center" contentEditable={false}>
				<TagChip
					color="violet"
					dataType="markdoc-details"
					label="Details"
					onSelect={handleSelectTag}
					selected={selected}
					summary={
						<>
							<span
								className={cn(
									"max-w-[24ch] truncate",
									summary ? "text-foreground/80" : "text-muted-foreground italic",
								)}
							>
								{summary || DEFAULT_DETAILS_SUMMARY}
							</span>
							{node.attrs.open ? (
								<span className="text-muted-foreground">· geöffnet</span>
							) : null}
						</>
					}
				/>
			</div>
			<NodeViewContent
				className={cn(
					"mt-1 flex w-full flex-col overflow-hidden rounded-md rounded-tl-none border px-2 py-1.5 whitespace-normal leading-normal",
					TAG_COLORS.violet.surface,
				)}
			/>
		</NodeViewWrapper>
	);
};
