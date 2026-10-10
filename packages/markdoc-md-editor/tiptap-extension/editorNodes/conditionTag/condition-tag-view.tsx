"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";

import { TagChip, useSelectTagNode } from "../tag-chip";

export const ConditionTagView = ({ editor, getPos, node, selected }: NodeViewProps) => (
	<NodeViewWrapper
		as="span"
		className="mx-0.5 inline-block align-[-0.125em] leading-none has-[[data-switch-expansion]>*]:inline"
		contentEditable={false}
	>
		<TagChip
			color="cyan"
			dataType="markdoc-condition"
			label="Condition"
			onSelect={useSelectTagNode({ editor, getPos })}
			selected={selected}
			summary={
				<>
					<span className="max-w-[20ch] truncate font-mono text-foreground/80">
						{(Array.isArray(node.attrs.primary)
							? node.attrs.primary.join(", ")
							: node.attrs.primary) || <span className="text-muted-foreground italic">leer</span>}
					</span>
					<span className="text-muted-foreground">· {node.attrs.cases?.length ?? 0} Fälle</span>
				</>
			}
		/>
		{/* The editor portals the expanded case tabs into this host, as for switches. */}
		<span data-switch-expansion="" className="block has-[*]:mt-1 has-[*]:mb-2" />
	</NodeViewWrapper>
);
