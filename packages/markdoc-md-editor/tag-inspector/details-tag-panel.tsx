"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { DEFAULT_DETAILS_SUMMARY } from "markdoc-md/config";
import { useCallback, useEffect, useId, useRef } from "react";

import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

export const DetailsTagPanel = ({
	editor,
	node,
	pos,
	selectPrimary,
}: {
	editor: Editor;
	node: ProseMirrorNode;
	pos: number;
	selectPrimary: boolean;
}) => {
	const id = useId();
	const summaryRef = useRef<HTMLInputElement>(null);
	const update = useCallback(
		(attrs: Record<string, unknown>) => updateMarkdocTagAttributes(editor, pos, attrs),
		[editor, pos],
	);

	useEffect(() => {
		if (selectPrimary) {
			summaryRef.current?.focus();
			summaryRef.current?.select();
		}
	}, [selectPrimary]);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor={`${id}-summary`}>
					Beschriftung (optional)
				</Label>
				<Input
					className="h-8 text-sm"
					id={`${id}-summary`}
					placeholder="z.B. Laborwerte"
					ref={summaryRef}
					value={node.attrs.summary ?? ""}
					onChange={(event) => update({ summary: event.target.value || null })}
				/>
				<p className="text-muted-foreground text-xs">
					Ohne Beschriftung zeigt der Abschnitt „{DEFAULT_DETAILS_SUMMARY}“ an.
				</p>
			</div>

			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<Label className="font-medium text-xs" htmlFor={`${id}-open`}>
						Standardmäßig geöffnet
					</Label>
					<p className="text-muted-foreground text-xs">
						Zugeklappte Abschnitte sind im Dokument erst nach dem Aufklappen sichtbar.
					</p>
				</div>
				<Switch
					checked={Boolean(node.attrs.open)}
					id={`${id}-open`}
					onCheckedChange={(checked) => update({ open: checked })}
				/>
			</div>
		</div>
	);
};
