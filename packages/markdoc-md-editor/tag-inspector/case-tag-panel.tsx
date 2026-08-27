"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

export const CaseTagPanel = ({
	editor,
	node,
	pos,
}: {
	editor: Editor;
	node: ProseMirrorNode;
	pos: number;
}) => {
	const handlePrimaryChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { primary: event.target.value });
		},
		[editor, pos],
	);
	const handleValueChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const value = event.target.value;
			updateMarkdocTagAttributes(editor, pos, {
				value: value === "" ? null : Number(value),
			});
		},
		[editor, pos],
	);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="case-tag-primary">
					Case Key
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-cyan focus:ring-solarized-cyan/50"
					id="case-tag-primary"
					onChange={handlePrimaryChange}
					placeholder="z.B. männlich, true"
					value={node.attrs.primary || ""}
				/>
				<Label className="font-medium text-xs" htmlFor="case-tag-value">
					Calc-Wert (optional)
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-cyan focus:ring-solarized-cyan/50"
					id="case-tag-value"
					onChange={handleValueChange}
					step="any"
					type="number"
					value={node.attrs.value ?? ""}
				/>
				<p className="text-muted-foreground text-xs">
					Der Inhalt des Case wird direkt im Editor bearbeitet.
				</p>
			</div>
		</div>
	);
};
