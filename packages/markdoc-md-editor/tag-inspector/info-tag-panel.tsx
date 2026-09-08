"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

import { CommonTagFields } from "./common-tag-fields";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const INFO_TYPE_NONE = "none";

const INFO_TYPE_OPTIONS = [
	{ label: "Standard", value: INFO_TYPE_NONE },
	{ label: "Text", value: "string" },
	{ label: "Zahl", value: "number" },
	{ label: "Datum", value: "date" },
] as const;

export const InfoTagPanel = ({
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
	const handleTypeChange = useCallback(
		(value: string) => {
			updateMarkdocTagAttributes(editor, pos, {
				type: value === INFO_TYPE_NONE ? null : value,
			});
		},
		[editor, pos],
	);

	const handleRenderUnitChange = useCallback(
		(checked: boolean) => {
			updateMarkdocTagAttributes(editor, pos, { renderUnit: checked });
		},
		[editor, pos],
	);

	const handleRoundChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, {
				round: event.target.value === "" ? null : Number(event.target.value),
			});
		},
		[editor, pos],
	);

	return (
		<div className="space-y-4">
			<CommonTagFields editor={editor} node={node} pos={pos} selectPrimary={selectPrimary} />

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="info-tag-type">
					Typ
				</Label>
				<Select onValueChange={handleTypeChange} value={node.attrs.type ?? INFO_TYPE_NONE}>
					<SelectTrigger className="h-8 text-sm" id="info-tag-type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{INFO_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Separator />

			<div className="space-y-2">
				<div>
					<Label className="font-medium text-xs">Nur für diese Instanz</Label>
					<p className="text-muted-foreground text-xs">
						Diese Einstellung wird nicht auf Tags mit demselben Variablennamen übertragen.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={node.attrs.renderUnit === true}
						id="info-tag-render-unit"
						onCheckedChange={(checked) => {
							handleRenderUnitChange(checked === true);
						}}
					/>
					<Label className="font-normal text-xs" htmlFor="info-tag-render-unit">
						Einheit im Dokument anzeigen
					</Label>
				</div>
				{node.attrs.type === "number" ? (
					<div className="space-y-1.5">
						<Label className="font-normal text-xs" htmlFor="info-tag-round">
							Nachkommastellen (optional)
						</Label>
						<Input
							className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
							id="info-tag-round"
							max={100}
							min={0}
							onChange={handleRoundChange}
							placeholder="Nicht runden"
							step={1}
							type="number"
							value={typeof node.attrs.round === "number" ? node.attrs.round : ""}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
};
