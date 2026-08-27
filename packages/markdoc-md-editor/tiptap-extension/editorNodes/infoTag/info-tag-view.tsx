"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Info } from "lucide-react";

import { TagChip, useSelectTagNode } from "../tag-chip";

export const InfoTagView = ({ editor, node, selected, deleteNode, getPos }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });

	return (
		<NodeViewWrapper
			as="span"
			className="mx-0.5 inline-block align-[-0.125em] leading-none"
			contentEditable={false}
		>
			<TagChip
				color="blue"
				dataType="markdoc-info"
				icon={Info}
				label="Info"
				onRemove={deleteNode}
				onSelect={handleSelectTag}
				removeLabel="Info-Tag entfernen"
				selected={selected}
				summary={
					<span className="max-w-[22ch] truncate font-mono text-foreground/80">
						{node.attrs.primary || <span className="text-muted-foreground italic">leer</span>}
					</span>
				}
			/>
		</NodeViewWrapper>
	);
};
