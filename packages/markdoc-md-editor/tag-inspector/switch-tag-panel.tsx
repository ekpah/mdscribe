"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { Code2, Plus, Trash2 } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
	SwitchCase,
	SwitchTagType,
} from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import {
	hasBooleanSwitchCaseShape,
	isBooleanSwitchType,
	normalizeBooleanSwitchCases,
} from "../tiptap-extension/editorNodes/switchTag/switch-tag";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const EMPTY_CASES: SwitchCase[] = [];

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
	const primaryInputRef = useRef<HTMLInputElement>(null);
	const [newCase, setNewCase] = useState({ primary: "", text: "", value: "" });

	const rawCases = Array.isArray(node.attrs.cases)
		? (node.attrs.cases as SwitchCase[])
		: EMPTY_CASES;
	const switchType = (node.attrs.type ?? null) as SwitchTagType | null;
	const isBooleanSwitch = isBooleanSwitchType(switchType);
	const cases = useMemo(
		() => (isBooleanSwitch ? normalizeBooleanSwitchCases(rawCases) : rawCases),
		[isBooleanSwitch, rawCases],
	);

	useEffect(() => {
		if (!selectPrimary) {
			return;
		}

		const animationFrame = requestAnimationFrame(() => {
			primaryInputRef.current?.focus();
			primaryInputRef.current?.select();
		});

		return () => {
			cancelAnimationFrame(animationFrame);
		};
	}, [selectPrimary]);

	useEffect(() => {
		if (isBooleanSwitch && !hasBooleanSwitchCaseShape(rawCases)) {
			updateMarkdocTagAttributes(editor, pos, { cases });
		}
	}, [cases, editor, isBooleanSwitch, pos, rawCases]);

	const handlePrimaryChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { primary: event.target.value });
		},
		[editor, pos],
	);

	const handleSourceChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { source: event.target.value || null });
		},
		[editor, pos],
	);

	const handleSelectType = useCallback(() => {
		updateMarkdocTagAttributes(editor, pos, { type: null });
	}, [editor, pos]);

	const handleCheckboxType = useCallback(() => {
		updateMarkdocTagAttributes(editor, pos, {
			cases: normalizeBooleanSwitchCases(cases),
			type: "boolean",
		});
	}, [cases, editor, pos]);

	const addCase = useCallback(() => {
		if (isBooleanSwitch || (!newCase.primary && !newCase.text)) {
			return;
		}
		const nextCases: SwitchCase[] = [
			...cases,
			{
				content: newCase.text,
				primary: newCase.primary,
				text: newCase.text,
				value: newCase.value === "" ? undefined : Number(newCase.value),
			},
		];
		updateMarkdocTagAttributes(editor, pos, { cases: nextCases });
		setNewCase({ primary: "", text: "", value: "" });
	}, [cases, editor, isBooleanSwitch, newCase, pos]);

	const updateCase = useCallback(
		(index: number, field: "primary" | "text" | "value", value: string) => {
			if (isBooleanSwitch && field === "primary") {
				return;
			}
			const nextCases = cases.map((caseItem, caseIndex) => {
				if (caseIndex !== index) {
					return caseItem;
				}
				if (field === "text") {
					return { ...caseItem, content: value, text: value };
				}
				if (field === "value") {
					return { ...caseItem, value: value === "" ? undefined : Number(value) };
				}
				return { ...caseItem, primary: value };
			});
			updateMarkdocTagAttributes(editor, pos, { cases: nextCases });
		},
		[cases, editor, isBooleanSwitch, pos],
	);

	const removeCase = useCallback(
		(index: number) => {
			if (isBooleanSwitch) {
				return;
			}
			const nextCases = cases.filter((_caseItem, caseIndex) => caseIndex !== index);
			updateMarkdocTagAttributes(editor, pos, { cases: nextCases });
		},
		[cases, editor, isBooleanSwitch, pos],
	);

	const casePrimaryChangeHandlers = useMemo<
		Record<number, (event: ChangeEvent<HTMLInputElement>) => void>
	>(() => {
		const handlers: Record<number, (event: ChangeEvent<HTMLInputElement>) => void> = {};
		for (let index = 0; index < cases.length; index += 1) {
			handlers[index] = (event) => {
				updateCase(index, "primary", event.target.value);
			};
		}
		return handlers;
	}, [cases.length, updateCase]);

	const caseTextChangeHandlers = useMemo<
		Record<number, (event: ChangeEvent<HTMLInputElement>) => void>
	>(() => {
		const handlers: Record<number, (event: ChangeEvent<HTMLInputElement>) => void> = {};
		for (let index = 0; index < cases.length; index += 1) {
			handlers[index] = (event) => {
				updateCase(index, "text", event.target.value);
			};
		}
		return handlers;
	}, [cases.length, updateCase]);

	const caseValueChangeHandlers = useMemo<
		Record<number, (event: ChangeEvent<HTMLInputElement>) => void>
	>(() => {
		const handlers: Record<number, (event: ChangeEvent<HTMLInputElement>) => void> = {};
		for (let index = 0; index < cases.length; index += 1) {
			handlers[index] = (event) => {
				updateCase(index, "value", event.target.value);
			};
		}
		return handlers;
	}, [cases.length, updateCase]);

	const removeCaseHandlers = useMemo<Record<number, () => void>>(() => {
		const handlers: Record<number, () => void> = {};
		for (let index = 0; index < cases.length; index += 1) {
			handlers[index] = () => {
				removeCase(index);
			};
		}
		return handlers;
	}, [cases.length, removeCase]);

	const handleNewCasePrimaryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewCase((prev) => ({ ...prev, primary: event.target.value }));
	}, []);

	const handleNewCaseTextChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewCase((prev) => ({ ...prev, text: event.target.value }));
	}, []);

	const handleNewCaseValueChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewCase((prev) => ({ ...prev, value: event.target.value }));
	}, []);

	const handleNewCaseTextKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter" && (newCase.primary || newCase.text)) {
				event.preventDefault();
				addCase();
			}
		},
		[addCase, newCase.primary, newCase.text],
	);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="switch-tag-primary">
					Variablenname
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-green focus:ring-solarized-green/50"
					id="switch-tag-primary"
					onChange={handlePrimaryChange}
					placeholder="z.B. patiententyp, zustand"
					ref={primaryInputRef}
					value={node.attrs.primary || ""}
				/>
			</div>

			<div className="space-y-1.5">
				<Label className="font-medium text-xs">Darstellung</Label>
				<div className="grid h-8 grid-cols-2 overflow-hidden rounded-xs border border-solarized-green/30 bg-background p-0.5">
					<button
						aria-pressed={!isBooleanSwitch}
						className={`rounded-[2px] px-2 text-xs transition-colors ${
							isBooleanSwitch
								? "text-muted-foreground hover:bg-solarized-green/10 hover:text-foreground"
								: "bg-solarized-green text-white shadow-xs"
						}`}
						onClick={handleSelectType}
						type="button"
					>
						Select
					</button>
					<button
						aria-pressed={isBooleanSwitch}
						className={`rounded-[2px] px-2 text-xs transition-colors ${
							isBooleanSwitch
								? "bg-solarized-green text-white shadow-xs"
								: "text-muted-foreground hover:bg-solarized-green/10 hover:text-foreground"
						}`}
						onClick={handleCheckboxType}
						type="button"
					>
						Checkbox
					</button>
				</div>
			</div>

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="switch-tag-source">
					Quelle (optional)
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-green focus:ring-solarized-green/50"
					id="switch-tag-source"
					onChange={handleSourceChange}
					placeholder="z.B. fhir://Patient..."
					value={node.attrs.source || ""}
				/>
			</div>

			<Separator />

			<div className="space-y-2">
				<Label className="font-medium text-xs">Optionen ({cases.length})</Label>

				<div className="space-y-2">
					{cases.map((caseItem, index) => (
						<div
							className="group rounded-md border border-solarized-green/20 bg-background p-2.5 shadow-xs transition-all hover:border-solarized-green/40"
							key={`case-${index}`}
						>
							<div className="flex items-start gap-2">
								<div className="flex-1 space-y-2">
									<div className="space-y-1">
										<Label className="text-muted-foreground text-xs">Label</Label>
										<Input
											className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
											disabled={isBooleanSwitch}
											onChange={casePrimaryChangeHandlers[index]}
											placeholder="Label"
											value={caseItem.primary}
										/>
									</div>
									<div className="space-y-1">
										<Label className="text-muted-foreground text-xs">Inhalt</Label>
										<Input
											className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
											onChange={caseTextChangeHandlers[index]}
											placeholder="Inhalt"
											value={caseItem.text}
										/>
									</div>
									{!isBooleanSwitch && (
										<div className="space-y-1">
											<Label className="text-muted-foreground text-xs">Calc-Wert</Label>
											<Input
												className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
												onChange={caseValueChangeHandlers[index]}
												placeholder="z.B. 0, 1 oder 2"
												step="any"
												type="number"
												value={caseItem.value ?? ""}
											/>
										</div>
									)}
								</div>
								{!isBooleanSwitch && (
									<Button
										aria-label={`Option ${index + 1} entfernen`}
										className="mt-5 h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
										onClick={removeCaseHandlers[index]}
										size="sm"
										title="Option entfernen"
										variant="ghost"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						</div>
					))}
				</div>

				{cases.length === 0 && (
					<div className="py-6 text-center text-muted-foreground">
						<Code2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
						<p className="font-medium text-xs">Noch keine Optionen definiert</p>
						<p className="mt-1 text-xs opacity-75">Fügen Sie unten eine neue Option hinzu</p>
					</div>
				)}

				{!isBooleanSwitch && (
					<div className="rounded border-2 border-solarized-green/30 border-dashed bg-solarized-green/5 p-2.5">
						<div className="space-y-2">
							<Label className="flex items-center gap-1.5 font-medium text-solarized-green text-xs">
								<Plus className="h-3 w-3" />
								Neue Option hinzufügen
							</Label>
							<div className="space-y-1.5">
								<Input
									className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
									onChange={handleNewCasePrimaryChange}
									placeholder="Label (z.B. 'männlich', 'Kind', '1')"
									value={newCase.primary}
								/>
								<Input
									className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
									onChange={handleNewCaseTextChange}
									onKeyDown={handleNewCaseTextKeyDown}
									placeholder="Inhalt für diese Option"
									value={newCase.text}
								/>
								<Input
									className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
									onChange={handleNewCaseValueChange}
									placeholder="Calc-Wert (optional)"
									step="any"
									type="number"
									value={newCase.value}
								/>
								<Button
									aria-label="Option hinzufügen"
									className="h-8 w-full bg-solarized-green text-sm hover:bg-solarized-green/90"
									disabled={!(newCase.primary || newCase.text)}
									onClick={addCase}
									size="sm"
								>
									<Plus className="mr-1.5 h-3.5 w-3.5" />
									Option hinzufügen
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
