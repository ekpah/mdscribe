"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { CornerDownRight } from "lucide-react";

import { TagChip, useSelectTagNode } from "../tag-chip";

export const CaseTagView = ({ node, editor, getPos, deleteNode, selected }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });

	return (
		<NodeViewWrapper as="span" className="mx-0.5 inline-block align-[-0.125em] leading-none">
			<TagChip
				color="cyan"
				dataType="markdoc-case"
				icon={CornerDownRight}
				label="Case"
				onRemove={deleteNode}
				onSelect={handleSelectTag}
				removeLabel="Case-Tag entfernen"
				selected={selected}
				summary={
					<span className="max-w-[16ch] truncate font-mono text-foreground/80">
						{node.attrs.primary || "default"}
					</span>
				}
			>
				<NodeViewContent<"span">
					as="span"
					className="whitespace-nowrap px-1 text-foreground/80 leading-none"
				/>
			</TagChip>
		</NodeViewWrapper>
	);
};
