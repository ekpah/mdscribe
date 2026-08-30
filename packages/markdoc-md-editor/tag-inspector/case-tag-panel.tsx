"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const conditionKeys = ["eq", "gt", "gte", "lt", "lte", "isDefault"] as const;

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
	const hasLower = node.attrs.gt != null || node.attrs.gte != null;
	const hasUpper = node.attrs.lt != null || node.attrs.lte != null;
	const conditionKind = node.attrs.isDefault
		? "default"
		: hasLower && hasUpper
			? "range"
			: (conditionKeys.find(
					(key) => key !== "isDefault" && node.attrs[key] !== null && node.attrs[key] !== undefined,
				) ?? "none");
	const handleConditionKind = useCallback(
		(kind: string) => {
			const attrs: Record<string, unknown> = { primary: kind === "none" ? node.attrs.primary : "" };
			for (const key of conditionKeys) attrs[key] = key === "isDefault" ? false : null;
			if (kind === "default") attrs.isDefault = true;
			else if (kind === "range") {
				attrs.gte = 0;
				attrs.lt = 0;
			} else if (kind !== "none") attrs[kind] = 0;
			updateMarkdocTagAttributes(editor, pos, attrs);
		},
		[editor, node.attrs.primary, pos],
	);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Bedingung</Label>
				<select
					className="h-8 w-full rounded border bg-background px-2 text-sm"
					value={conditionKind}
					onChange={(event) => handleConditionKind(event.target.value)}
				>
					<option value="none">Case Key</option>
					<option value="eq">gleich</option>
					<option value="gt">größer als</option>
					<option value="gte">mindestens</option>
					<option value="lt">kleiner als</option>
					<option value="lte">höchstens</option>
					<option value="range">Bereich</option>
					<option value="default">Sonst / Standardfall</option>
				</select>
				{conditionKind === "range" ? (
					<div className="grid grid-cols-2 gap-2">
						<Input
							type="number"
							step="any"
							value={node.attrs.gte ?? 0}
							onChange={(event) =>
								updateMarkdocTagAttributes(editor, pos, { gte: Number(event.target.value) })
							}
						/>
						<Input
							type="number"
							step="any"
							value={node.attrs.lt ?? 0}
							onChange={(event) =>
								updateMarkdocTagAttributes(editor, pos, { lt: Number(event.target.value) })
							}
						/>
					</div>
				) : (
					conditionKind !== "none" &&
					conditionKind !== "default" && (
						<Input
							type="number"
							step="any"
							value={node.attrs[conditionKind] ?? 0}
							onChange={(event) =>
								updateMarkdocTagAttributes(editor, pos, {
									[conditionKind]: Number(event.target.value),
								})
							}
						/>
					)
				)}
				{conditionKind === "none" && (
					<>
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
					</>
				)}
				{conditionKind === "none" && (
					<>
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
					</>
				)}
				<p className="text-muted-foreground text-xs">
					Der Inhalt des Case wird direkt im Editor bearbeitet.
				</p>
			</div>
		</div>
	);
};
