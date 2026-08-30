"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";

import type {
	SwitchCase,
	SwitchTagType,
} from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import { normalizeBooleanSwitchCases } from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

type Kind = "eq" | "gt" | "gte" | "lt" | "lte" | "range" | "default";
const conditionKeys = ["eq", "gt", "gte", "lt", "lte", "isDefault"] as const;
const kindOf = (item: SwitchCase): Kind =>
	item.isDefault
		? "default"
		: item.eq !== undefined
			? "eq"
			: (item.gt !== undefined || item.gte !== undefined) &&
				  (item.lt !== undefined || item.lte !== undefined)
				? "range"
				: item.gt !== undefined
					? "gt"
					: item.gte !== undefined
						? "gte"
						: item.lte !== undefined
							? "lte"
							: "lt";
const clearCondition = (item: SwitchCase): SwitchCase => {
	const copy = { ...item };
	for (const key of conditionKeys) delete copy[key];
	return copy;
};
const setKind = (item: SwitchCase, kind: Kind): SwitchCase => ({
	...clearCondition(item),
	primary: "",
	...(kind === "default"
		? { isDefault: true }
		: kind === "range"
			? { gte: 0, lt: 0 }
			: { [kind]: 0 }),
});

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
	const primaryRef = useRef<HTMLInputElement>(null);
	const cases = useMemo(
		() => (Array.isArray(node.attrs.cases) ? (node.attrs.cases as SwitchCase[]) : []),
		[node.attrs.cases],
	);
	const type = (node.attrs.type ?? null) as SwitchTagType | null;
	const number = type === "number";
	const boolean = type === "boolean";
	const update = useCallback(
		(attrs: Record<string, unknown>) => updateMarkdocTagAttributes(editor, pos, attrs),
		[editor, pos],
	);
	const changeType = (next: SwitchTagType | null) => {
		const nextCases =
			next === "boolean"
				? normalizeBooleanSwitchCases(cases)
				: cases.map((item) =>
						next === "number"
							? setKind(item, "eq")
							: { ...clearCondition(item), primary: item.primary || "" },
					);
		update({ cases: nextCases, type: next });
	};
	const changeCase = (index: number, patch: Partial<SwitchCase>) =>
		update({ cases: cases.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
	const remove = (index: number) => update({ cases: cases.filter((_, i) => i !== index) });
	const add = () =>
		update({
			cases: [
				...cases,
				number
					? setKind({ primary: "", text: "", content: "" }, "eq")
					: { primary: "", text: "", content: "" },
			],
		});
	const conditionNumber = (index: number, key: "eq" | "gt" | "gte" | "lt" | "lte", value: string) =>
		changeCase(index, { [key]: value === "" ? 0 : Number(value) });

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Variablenname</Label>
				<Input
					ref={primaryRef}
					autoFocus={selectPrimary}
					value={node.attrs.primary || ""}
					onChange={(e) => update({ primary: e.target.value })}
					placeholder="z.B. psa"
				/>
			</div>
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Darstellung</Label>
				<div className="grid grid-cols-3 gap-1">
					{(
						[
							[null, "Select"],
							["boolean", "Checkbox"],
							["number", "Zahl"],
						] as const
					).map(([value, label]) => (
						<Button
							key={label}
							size="sm"
							variant={type === value || (!type && value === null) ? "default" : "outline"}
							onClick={() => changeType(value)}
						>
							{label}
						</Button>
					))}
				</div>
			</div>
			{number && (
				<div className="space-y-1.5">
					<Label className="font-medium text-xs">Einheit (optional)</Label>
					<Input
						value={node.attrs.unit || ""}
						onChange={(e) => update({ unit: e.target.value || null })}
						placeholder="z.B. ng/ml"
					/>
				</div>
			)}
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Beschreibung (optional)</Label>
				<Input
					value={node.attrs.description || ""}
					onChange={(e) => update({ description: e.target.value || null })}
				/>
			</div>
			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Quelle (optional)</Label>
				<Input
					value={node.attrs.source || ""}
					onChange={(e) => update({ source: e.target.value || null })}
				/>
			</div>
			<Separator />
			<div className="space-y-2">
				<Label className="font-medium text-xs">Optionen ({cases.length})</Label>
				{cases.map((item, index) => {
					const kind = kindOf(item);
					const lowerKey = item.gt !== undefined ? "gt" : "gte";
					const upperKey = item.lte !== undefined ? "lte" : "lt";
					return (
						<div className="space-y-2 rounded-md border p-2.5" key={index}>
							{number ? (
								<>
									<select
										className="h-8 w-full rounded border bg-background px-2 text-xs"
										value={kind}
										onChange={(e) => changeCase(index, setKind(item, e.target.value as Kind))}
									>
										<option value="eq">gleich</option>
										<option value="gt">größer als</option>
										<option value="gte">mindestens</option>
										<option value="lt">kleiner als</option>
										<option value="lte">höchstens</option>
										<option value="range">Bereich</option>
										<option value="default">Sonst / Standardfall</option>
									</select>
									{kind !== "default" &&
										(kind === "range" ? (
											<div className="grid grid-cols-2 gap-2">
												<select
													className="h-8 rounded border bg-background text-xs"
													value={lowerKey}
													onChange={(e) =>
														changeCase(index, {
															...clearCondition(item),
															primary: "",
															[e.target.value]: item[lowerKey] ?? 0,
															[upperKey]: item[upperKey] ?? 0,
														})
													}
												>
													<option value="gt">größer als</option>
													<option value="gte">mindestens</option>
												</select>
												<select
													className="h-8 rounded border bg-background text-xs"
													value={upperKey}
													onChange={(e) =>
														changeCase(index, {
															...clearCondition(item),
															primary: "",
															[lowerKey]: item[lowerKey] ?? 0,
															[e.target.value]: item[upperKey] ?? 0,
														})
													}
												>
													<option value="lt">kleiner als</option>
													<option value="lte">höchstens</option>
												</select>
												<Input
													type="number"
													step="any"
													value={item[lowerKey] ?? 0}
													onChange={(e) => conditionNumber(index, lowerKey, e.target.value)}
												/>
												<Input
													type="number"
													step="any"
													value={item[upperKey] ?? 0}
													onChange={(e) => conditionNumber(index, upperKey, e.target.value)}
												/>
											</div>
										) : (
											<Input
												type="number"
												step="any"
												value={item[kind] ?? 0}
												onChange={(e) => conditionNumber(index, kind, e.target.value)}
											/>
										))}
								</>
							) : (
								<Input
									disabled={boolean}
									value={item.primary}
									onChange={(e) => changeCase(index, { primary: e.target.value })}
									placeholder="Label"
								/>
							)}
							<Input
								value={item.text}
								onChange={(e) =>
									changeCase(index, { text: e.target.value, content: e.target.value })
								}
								placeholder="Inhalt"
							/>
							{!boolean && !number && (
								<Input
									type="number"
									step="any"
									value={item.value ?? ""}
									onChange={(e) =>
										changeCase(index, {
											value: e.target.value === "" ? undefined : Number(e.target.value),
										})
									}
									placeholder="Calc-Wert (optional)"
								/>
							)}
							{!boolean && (
								<Button variant="ghost" size="sm" onClick={() => remove(index)}>
									<Trash2 className="mr-1 h-3.5 w-3.5" /> Entfernen
								</Button>
							)}
						</div>
					);
				})}
				{!boolean && (
					<Button className="w-full" variant="outline" size="sm" onClick={add}>
						<Plus className="mr-1 h-3.5 w-3.5" /> Option hinzufügen
					</Button>
				)}
			</div>
		</div>
	);
};
