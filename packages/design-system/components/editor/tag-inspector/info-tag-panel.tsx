"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import type { ChangeEvent } from "react";
import { useCallback } from "react";

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

	const handleTypeChange = useCallback(
		(value: string) => {
			updateMarkdocTagAttributes(editor, pos, {
				type: value === INFO_TYPE_NONE ? null : value,
			});
		},
		[editor, pos],
	);

	const handleUnitChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { unit: event.target.value || null });
		},
		[editor, pos],
	);

	const handleDescriptionChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { description: event.target.value || null });
		},
		[editor, pos],
	);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="info-tag-primary">
					Variablenname
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
					id="info-tag-primary"
					onChange={handlePrimaryChange}
					placeholder="z.B. patientenname, alter"
					value={node.attrs.primary || ""}
				/>
			</div>

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

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="info-tag-unit">
					Einheit (optional)
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
					id="info-tag-unit"
					onChange={handleUnitChange}
					placeholder="z.B. kg, mmHg"
					value={node.attrs.unit || ""}
				/>
			</div>

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="info-tag-description">
					Beschreibung (optional)
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
					id="info-tag-description"
					onChange={handleDescriptionChange}
					placeholder="Hinweis für das Ausfüllen"
					value={node.attrs.description || ""}
				/>
			</div>
		</div>
	);
};
