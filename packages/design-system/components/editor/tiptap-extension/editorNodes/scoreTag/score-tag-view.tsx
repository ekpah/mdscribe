"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Calculator } from "lucide-react";

import { TagChip, useSelectTagNode } from "../tag-chip";

export const ScoreTagView = ({ node, selected, editor, deleteNode, getPos }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });

	const formulaValue = node.attrs.formula ?? "";
	const unitValue = node.attrs.unit ?? "";

	return (
		<NodeViewWrapper
			as="span"
			className="mx-0.5 inline-block align-[-0.125em] leading-none"
			contentEditable={false}
		>
			<TagChip
				color="orange"
				dataType="markdoc-score"
				icon={Calculator}
				label="Score"
				onRemove={deleteNode}
				onSelect={handleSelectTag}
				removeLabel="Score-Tag entfernen"
				selected={selected}
				summary={
					<>
						<span className="max-w-[22ch] truncate font-mono text-foreground/80">
							{formulaValue || <span className="text-muted-foreground italic">Formel</span>}
						</span>
						{unitValue ? <span className="text-muted-foreground">· {unitValue}</span> : null}
					</>
				}
			/>
		</NodeViewWrapper>
	);
};
