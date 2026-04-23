"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { Code2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

import type { SwitchCase, SwitchTagType } from "./switch-tag";

interface CaseItem {
	primary: string;
	text: string;
	content?: string;
}

const EMPTY_CASES: CaseItem[] = [];

const BOOLEAN_CASE_PRIMARY_VALUES = ["true", "false"] as const;

const isBooleanSwitchType = (value: SwitchTagType | null | undefined): boolean =>
	value === "boolean";

const normalizeBooleanCases = (cases: CaseItem[]): CaseItem[] =>
	BOOLEAN_CASE_PRIMARY_VALUES.map((primary) => {
		const existing = cases.find((caseItem) => caseItem.primary === primary);
		return {
			content: existing?.content ?? existing?.text ?? "",
			primary,
			text: existing?.text ?? "",
		};
	});

const hasBooleanCaseShape = (cases: CaseItem[]): boolean =>
	cases.length === BOOLEAN_CASE_PRIMARY_VALUES.length &&
	BOOLEAN_CASE_PRIMARY_VALUES.every((primary) =>
		cases.some((caseItem) => caseItem.primary === primary),
	);

// Renamed function to SwitchTagView
export const SwitchTagView = ({
	node,
	editor,
	updateAttributes,
	getPos,
	selected,
	deleteNode,
}: NodeViewProps) => {
	const [newCase, setNewCase] = useState({ content: "", primary: "", text: "" });
	const rawCases = Array.isArray(node.attrs.cases) ? (node.attrs.cases as CaseItem[]) : EMPTY_CASES;
	const switchType = (node.attrs.type ?? null) as SwitchTagType | null;
	const isBooleanSwitch = isBooleanSwitchType(switchType);
	const cases = useMemo(
		() => (isBooleanSwitch ? normalizeBooleanCases(rawCases) : rawCases),
		[isBooleanSwitch, rawCases],
	);

	useEffect(() => {
		if (isBooleanSwitch && !hasBooleanCaseShape(rawCases)) {
			updateAttributes({ cases });
		}
	}, [cases, isBooleanSwitch, rawCases, updateAttributes]);

	const handleRemoveSwitch = useCallback(() => {
		deleteNode();
	}, [deleteNode]);

	const handleSelectTag = useCallback(() => {
		const pos = getPos?.();
		if (typeof pos === "number") {
			editor.chain().focus().setNodeSelection(pos).run();
		}
	}, [editor, getPos]);

	const addCase = useCallback(() => {
		if (isBooleanSwitch) {
			return;
		}
		if (!newCase.primary && !newCase.text) {
			return;
		}
		const nextCases: SwitchCase[] = [
			...cases,
			{
				content: newCase.text,
				primary: newCase.primary,
				text: newCase.text,
			},
		];
			updateAttributes({ cases: nextCases });
			setNewCase({ content: "", primary: "", text: "" });
	}, [cases, isBooleanSwitch, newCase, updateAttributes]);

	const removeCase = useCallback(
		(index: number) => {
			if (isBooleanSwitch) {
				return;
			}
			const nextCases = cases.filter((_caseItem, caseIndex) => caseIndex !== index);
			updateAttributes({ cases: nextCases });
		},
		[cases, isBooleanSwitch, updateAttributes],
	);

	const updateCase = useCallback(
		(index: number, field: "primary" | "text", value: string) => {
			if (isBooleanSwitch && field === "primary") {
				return;
			}
			const nextCases = cases.map((caseItem, caseIndex) => {
				if (caseIndex !== index) {
					return caseItem;
				}
				if (field === "text") {
					return {
						...caseItem,
						content: value,
						text: value,
					};
				}
				return {
					...caseItem,
					[field]: value,
				};
			});
			updateAttributes({ cases: nextCases });
		},
		[cases, isBooleanSwitch, updateAttributes],
	);

	const handleTypeChange = useCallback(
		(value: string) => {
			if (value === "boolean") {
				updateAttributes({
					cases: normalizeBooleanCases(cases),
					type: "boolean",
				});
				return;
			}

			updateAttributes({
				type: null,
			});
		},
		[cases, updateAttributes],
	);

	const handlePrimaryChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateAttributes({
				primary: event.target.value,
			});
		},
		[updateAttributes],
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
		setNewCase((prev) => ({
			...prev,
			primary: event.target.value,
		}));
	}, []);

	const handleNewCaseTextChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewCase((prev) => ({
			...prev,
			content: event.target.value,
			text: event.target.value,
		}));
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
		// Use span for inline behavior, align-baseline for text alignment
		<NodeViewWrapper as="span" className="inline-block align-baseline mx-1" contentEditable={false}>
			<span
				className={`group inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs shadow-xs transition-all ${
					selected
						? "border-solarized-green ring-2 ring-solarized-green/40"
						: "border-solarized-green/60 hover:border-solarized-green"
				}`}
			>
				<Popover>
					{/* Reverted trigger to match InfoTagView style */}
					<PopoverTrigger
						className="inline-flex cursor-pointer items-center gap-1.5 px-1 py-0.5"
						data-type="markdoc-switch"
						data-primary={node.attrs.primary}
						contentEditable={false}
						onMouseDown={handleSelectTag}
					>
						{/* Switch Label */}
						<span
							data-drag-handle
							className="inline-flex items-center gap-1 rounded bg-solarized-green/15 px-1.5 py-0.5 font-semibold text-solarized-green"
						>
							<Code2 className="h-3 w-3" />
							Switch
						</span>

						{/* Content Part */}
						<span className="max-w-[20ch] truncate font-mono text-foreground/80">
							{node.attrs.primary || <span className="text-muted-foreground italic">leer</span>}
						</span>
						<span className="text-muted-foreground">· {cases.length} Fälle</span>
					</PopoverTrigger>

					{/* More compact popover content */}
					<PopoverContent
						collisionPadding={12}
						className="w-[min(380px,96vw)] max-h-[min(80vh,var(--radix-popover-content-available-height))] overflow-hidden p-0"
					>
						<div className="flex max-h-[min(80vh,var(--radix-popover-content-available-height))] flex-col">
							{/* Compact header */}
							<div className="shrink-0 border-b bg-solarized-green/5 px-3 py-2">
								<h3 className="flex items-center font-medium text-sm text-solarized-green">
									<Code2 className="mr-1.5 h-3 w-3" />
									Switch-Konfiguration
								</h3>
							</div>

							<div className="min-h-0 flex-1 overflow-y-auto">
								<div className="space-y-3 p-3">
									{/* Switch Variable Input */}
										<div className="space-y-1.5">
											<Label htmlFor="primary" className="font-medium text-xs">
												Variablenname
											</Label>
										<Input
											id="primary"
											value={node.attrs.primary || ""}
											onChange={handlePrimaryChange}
											placeholder="z.B. patiententyp, zustand"
											className="h-8 text-sm focus:border-solarized-green focus:ring-solarized-green/50"
												autoFocus
											/>
										</div>

										<div className="space-y-1.5">
											<Label className="font-medium text-xs">Switch-Typ</Label>
											<Select
												onValueChange={handleTypeChange}
												value={isBooleanSwitch ? "boolean" : "default"}
											>
												<SelectTrigger className="h-8 text-xs">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="default">Standard</SelectItem>
													<SelectItem value="boolean">Boolean (Checkbox)</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<Separator />

									{/* Cases Section */}
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label className="font-medium text-xs">Fälle ({cases.length})</Label>
										</div>

										{/* Existing Cases */}
										<div className="space-y-2">
											{cases.map((caseItem, index) => {
												const handleCasePrimaryChange = casePrimaryChangeHandlers[index];
												const handleCaseTextChange = caseTextChangeHandlers[index];
												const handleRemoveCase = removeCaseHandlers[index];

												return (
													<div
														key={`${caseItem.primary}:${caseItem.text}`}
														className="group rounded-md border border-solarized-green/20 bg-background p-2.5 shadow-sm transition-all hover:border-solarized-green/40 hover:shadow"
													>
														<div className="flex items-start gap-2">
															<div className="flex-1 space-y-2">
																<div className="space-y-1">
																	<Label className="text-muted-foreground text-xs">Wert</Label>
																		<Input
																			value={caseItem.primary}
																			onChange={handleCasePrimaryChange}
																			placeholder="Fall-Wert"
																			disabled={isBooleanSwitch}
																			className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
																		/>
																</div>
																<div className="space-y-1">
																	<Label className="text-muted-foreground text-xs">Inhalt</Label>
																	<Input
																		value={caseItem.text}
																		onChange={handleCaseTextChange}
																		placeholder="Inhalt"
																		className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
																	/>
																</div>
															</div>
																{!isBooleanSwitch && (
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={handleRemoveCase}
																		className="mt-5 h-8 w-8 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
																		aria-label={`Fall ${index + 1} entfernen`}
																		title="Fall entfernen"
																	>
																		<Trash2 className="h-3.5 w-3.5" />
																	</Button>
																)}
															</div>
														</div>
													);
												})}
											</div>

											{!isBooleanSwitch && (
												<div className="rounded border-2 border-solarized-green/30 border-dashed bg-solarized-green/5 p-2.5">
													<div className="space-y-2">
														<Label className="flex items-center gap-1.5 font-medium text-solarized-green text-xs">
															<Plus className="h-3 w-3" />
															Neuen Fall hinzufügen
														</Label>
														<div className="space-y-1.5">
															<Input
																value={newCase.primary}
																onChange={handleNewCasePrimaryChange}
																placeholder="Fall-Wert (z.B. 'männlich', 'Kind', '1')"
																className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
															/>
															<Input
																value={newCase.text}
																onChange={handleNewCaseTextChange}
																placeholder="Inhalt für diesen Fall"
																className="h-8 text-xs focus:border-solarized-green focus:ring-solarized-green/50"
																onKeyDown={handleNewCaseTextKeyDown}
															/>
															<Button
																size="sm"
																onClick={addCase}
																disabled={!newCase.primary && !newCase.text}
																className="h-8 w-full bg-solarized-green text-sm hover:bg-solarized-green/90"
																aria-label="Fall hinzufügen"
															>
																<Plus className="mr-1.5 h-3.5 w-3.5" />
																Fall hinzufügen
															</Button>
														</div>
													</div>
												</div>
											)}

										{cases.length === 0 && (
											<div className="py-6 text-center text-muted-foreground">
												<Code2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
												<p className="font-medium text-xs">Noch keine Fälle definiert</p>
												<p className="mt-1 text-xs opacity-75">
													Fügen Sie unten einen neuen Fall hinzu
												</p>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>

				<Button
					variant="ghost"
					size="icon"
					onClick={handleRemoveSwitch}
					className="h-6 w-6 rounded-sm text-solarized-green/70 hover:bg-solarized-green/10 hover:text-solarized-green"
					contentEditable={false}
					aria-label="Remove switch tag"
				>
					<X className="h-3 w-3" />
				</Button>
			</span>
		</NodeViewWrapper>
	);
};
