"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";

import { TagChip, useSelectTagNode } from "../tag-chip";
import type { SwitchCase, SwitchTagType } from "./switch-tag";
import { isBooleanSwitchType, normalizeBooleanSwitchCases } from "./switch-tag";

const EMPTY_CASES: SwitchCase[] = [];

export const SwitchTagView = ({ editor, node, getPos, selected }: NodeViewProps) => {
	const handleSelectTag = useSelectTagNode({ editor, getPos });

	const rawCases = Array.isArray(node.attrs.cases)
		? (node.attrs.cases as SwitchCase[])
		: EMPTY_CASES;
	const switchType = (node.attrs.type ?? null) as SwitchTagType | null;
	const cases = useMemo(
		() => (isBooleanSwitchType(switchType) ? normalizeBooleanSwitchCases(rawCases) : rawCases),
		[switchType, rawCases],
	);

	return (
		<NodeViewWrapper
			as="span"
			className="mx-0.5 inline-block align-[-0.125em] leading-none has-[[data-switch-expansion]>*]:inline"
			contentEditable={false}
		>
			<TagChip
				color="green"
				dataType="markdoc-switch"
				label="Switch"
				onSelect={handleSelectTag}
				selected={selected}
				summary={
					<>
						<span className="max-w-[20ch] truncate font-mono text-foreground/80">
							{node.attrs.primary || <span className="text-muted-foreground italic">leer</span>}
						</span>
						<span className="text-muted-foreground">· {cases.length} Optionen</span>
					</>
				}
			/>
			<span data-switch-expansion="" className="block has-[*]:mt-1 has-[*]:mb-2" />
		</NodeViewWrapper>
	);
};
