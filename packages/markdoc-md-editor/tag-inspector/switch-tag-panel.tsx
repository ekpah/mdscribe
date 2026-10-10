"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { normalizeBooleanSwitchCases } from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import type { SwitchCase } from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import { CommonTagFields } from "./common-tag-fields";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

/**
 * An option key is committed when editing ends: an intermediate key while
 * typing would otherwise pick up the shared value of an unrelated option.
 */
const OptionKeyInput = ({
	disabled,
	value,
	onCommit,
}: {
	disabled: boolean;
	value: string;
	onCommit: (value: string) => void;
}) => {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	const commit = () => {
		const next = draft.trim();
		if (next && next !== value) {
			onCommit(next);
		} else {
			setDraft(value);
		}
	};
	return (
		<Input
			aria-label="Optionsname"
			disabled={disabled}
			onBlur={commit}
			onChange={(event) => setDraft(event.target.value)}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					commit();
				}
			}}
			placeholder="Optionsname"
			value={draft}
		/>
	);
};

const nextOptionName = (cases: SwitchCase[]): string => {
	let index = cases.length + 1;
	while (cases.some((item) => item.primary === `Option ${index}`)) {
		index += 1;
	}
	return `Option ${index}`;
};

export const SwitchTagPanel = ({
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
	const cases: SwitchCase[] = Array.isArray(node.attrs.cases) ? node.attrs.cases : [];
	const boolean = node.attrs.type === "boolean";
	const update = (attributes: Record<string, unknown>) =>
		updateMarkdocTagAttributes(editor, pos, attributes);
	const changeCase = (index: number, patch: Partial<SwitchCase>) =>
		update({ cases: cases.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
	if (Array.isArray(node.attrs.primary) || node.attrs.type === "number") {
		return (
			<p className="text-sm text-muted-foreground">
				Ungültiger Switch: Für numerische Vergleiche oder mehrere Feldnamen bitte einen
				Condition-Tag ohne Fallwerte verwenden.
			</p>
		);
	}
	return (
		<div className="space-y-4">
			<CommonTagFields editor={editor} node={node} pos={pos} selectPrimary={selectPrimary} />
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Darstellung</Label>
				<div className="grid grid-cols-2 gap-1">
					{([false, true] as const).map((checkbox) => (
						<Button
							key={String(checkbox)}
							size="sm"
							variant={boolean === checkbox ? "default" : "outline"}
							onClick={() =>
								update({
									type: checkbox ? "boolean" : null,
									cases: checkbox ? normalizeBooleanSwitchCases(cases) : cases,
								})
							}
						>
							{checkbox ? "Checkbox" : "Select"}
						</Button>
					))}
				</div>
			</div>
			<Separator />
			<div className="space-y-2">
				<Label className="font-medium text-xs">Optionen ({cases.length})</Label>
				<p className="text-xs text-muted-foreground">
					Inhalte und verschachtelte Tags links über die Optionen-Tabs bearbeiten.
					{boolean &&
						" Standardwerte: true = 1, false = 0. Eigene Calc-Werte überschreiben diese einzeln."}
				</p>
				{cases.map((item, index) => (
					<div className="space-y-2 rounded-md border p-2.5" key={index}>
						{!boolean && (
							<label className="text-xs">
								<input
									type="checkbox"
									checked={Boolean(item.isDefault)}
									onChange={(event) =>
										changeCase(index, {
											isDefault: event.target.checked,
											primary: event.target.checked ? "" : item.primary || nextOptionName(cases),
											value: event.target.checked ? undefined : item.value,
										})
									}
								/>{" "}
								Standardfall (nur Darstellung)
							</label>
						)}
						{!item.isDefault && (
							<OptionKeyInput
								disabled={boolean}
								value={item.primary}
								onCommit={(primary) => changeCase(index, { primary })}
							/>
						)}
						<p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">
							{item.text || "Noch kein Inhalt"}
						</p>
						{!item.isDefault && (
							<Input
								type="number"
								step="any"
								value={String(item.value ?? "")}
								onChange={(event) =>
									changeCase(index, {
										value: event.target.value === "" ? undefined : Number(event.target.value),
									})
								}
								aria-label={`Calc-Wert ${item.primary}`}
								placeholder="Calc-Wert (optional)"
							/>
						)}
						{!boolean && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => update({ cases: cases.filter((_, i) => i !== index) })}
							>
								<Trash2 className="mr-1 h-3.5 w-3.5" /> Entfernen
							</Button>
						)}
					</div>
				))}
				{!boolean && (
					<Button
						className="w-full"
						variant="outline"
						size="sm"
						onClick={() =>
							update({
								// Every option needs a key; start from a unique placeholder name.
								cases: [
									...cases,
									{
										content: "",
										primary: nextOptionName(cases),
										text: "",
									},
								],
							})
						}
					>
						<Plus className="mr-1 h-3.5 w-3.5" /> Option hinzufügen
					</Button>
				)}
			</div>
		</div>
	);
};
