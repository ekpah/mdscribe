"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

import { TagChip, useSelectTagNode } from "../tag-chip";

export const CalcTagView = ({ editor, node, selected, getPos }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });

	const primaryValue = node.attrs.primary ?? "";
	const unitValue = node.attrs.unit ?? "";

	return (
		<NodeViewWrapper
			as="span"
			className="mx-0.5 inline-block align-[-0.125em] leading-none"
			contentEditable={false}
		>
			<TagChip
				color="orange"
				dataType="markdoc-calc"
				label="Calc"
				onSelect={handleSelectTag}
				selected={selected}
				summary={
					<>
						<span className="max-w-[22ch] truncate text-foreground/80">
							{primaryValue || <span className="text-muted-foreground italic">Ohne Namen</span>}
						</span>
						{node.attrs.renderUnit && unitValue ? (
							<span className="text-muted-foreground">· {unitValue}</span>
						) : null}
					</>
				}
			/>
		</NodeViewWrapper>
	);
};
