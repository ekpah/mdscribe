"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getFormulaVariables } from "markdoc-md/parse";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CalcComponent } from "../tiptap-extension/editorNodes/calcTag/calc-tag";
import {
	calcComponentNames,
	toCalcComponent,
} from "../tiptap-extension/editorNodes/calcTag/calc-tag";
import { CommonTagFields } from "./common-tag-fields";
import { ConditionFields } from "./condition-fields";
import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const CALC_OPERATORS = ["+", "-", "*", "/", "(", ")"] as const;

export const CalcTagPanel = ({
	editor,
	node,
	pos,
	selectPrimary = false,
}: {
	editor: Editor;
	node: ProseMirrorNode;
	pos: number;
	selectPrimary?: boolean;
}) => {
	const formulaValue = node.attrs.formula ?? "";
	const formulaInputRef = useRef<HTMLTextAreaElement>(null);
	const [availableComponents, setAvailableComponents] = useState<CalcComponent[]>([]);
	const [computedVariables, setComputedVariables] = useState<Map<string, number>>(new Map());
	const calcComponents = useMemo(
		() => (Array.isArray(node.attrs.components) ? (node.attrs.components as CalcComponent[]) : []),
		[node.attrs.components],
	);
	const availableVariables = [...new Set(availableComponents.flatMap(calcComponentNames))];

	useEffect(() => {
		const updateVariables = () => {
			const components = new Map<string, CalcComponent>();
			const calculations = new Map<string, number>();
			editor.state.doc.descendants((docNode) => {
				const component = toCalcComponent(docNode);
				if (component?.kind !== "condition" && typeof component?.primary === "string") {
					components.set(component.primary, component);
				}
			});
			editor.state.doc.descendants((docNode, docPos) => {
				if (
					docNode.type.name === "calcTag" &&
					docNode.attrs.primary &&
					docNode.attrs.primary !== node.attrs.primary
				) {
					calculations.set(docNode.attrs.primary, docPos);
					// A compatible info declaration references the computed contract;
					// it does not create another manual input.
					components.set(docNode.attrs.primary, {
						kind: "info",
						primary: docNode.attrs.primary,
						type: "number",
					});
				}
			});
			setComputedVariables(calculations);
			for (const component of calcComponents) {
				for (const name of calcComponentNames(component)) {
					if (!components.has(name)) {
						components.set(name, component);
					}
				}
			}
			setAvailableComponents(
				[...components.values()].toSorted((left, right) =>
					String(left.primary).localeCompare(String(right.primary)),
				),
			);
		};

		updateVariables();
		editor.on("update", updateVariables);

		return () => {
			editor.off("update", updateVariables);
		};
	}, [calcComponents, editor, node.attrs.primary]);

	const { parsedVariables, parseError } = useMemo(() => {
		if (!formulaValue.trim()) {
			return { parseError: null as Error | null, parsedVariables: [] };
		}

		try {
			return {
				parseError: null,
				parsedVariables: getFormulaVariables(formulaValue),
			};
		} catch (error) {
			return {
				parseError: error as Error,
				parsedVariables: [],
			};
		}
	}, [formulaValue]);

	const setFormula = useCallback(
		(formula: string) => {
			let components = calcComponents;
			try {
				const variables = getFormulaVariables(formula);
				const componentsByPrimary = new Map(
					[...availableComponents, ...calcComponents].flatMap((component) =>
						calcComponentNames(component).map((name) => [name, component] as const),
					),
				);
				components = [
					...new Set(
						variables.flatMap((variable) => {
							const component = componentsByPrimary.get(variable);
							return component ? [component] : [];
						}),
					),
				];
			} catch {
				// Keep the last valid component set while the formula is incomplete.
			}
			updateMarkdocTagAttributes(editor, pos, { components, formula });
		},
		[availableComponents, calcComponents, editor, pos],
	);

	const insertIntoFormula = useCallback(
		(snippet: string) => {
			const current = formulaValue;
			const input = formulaInputRef.current;

			if (!input) {
				setFormula(`${current}${snippet}`);
				return;
			}

			const start = input.selectionStart ?? current.length;
			const end = input.selectionEnd ?? current.length;
			setFormula(`${current.slice(0, start)}${snippet}${current.slice(end)}`);

			requestAnimationFrame(() => {
				input.focus();
				const cursor = start + snippet.length;
				input.setSelectionRange(cursor, cursor);
			});
		},
		[formulaValue, setFormula],
	);

	const insertVariable = useCallback(
		(variable: string) => {
			const normalized = variable.trim().replaceAll(/^\[|\]$/g, "");
			if (!normalized) {
				return;
			}
			insertIntoFormula(`[${normalized}]`);
		},
		[insertIntoFormula],
	);

	const insertOperator = useCallback(
		(operator: string) => {
			const snippet = formulaValue.trim() ? ` ${operator} ` : operator;
			insertIntoFormula(snippet);
		},
		[formulaValue, insertIntoFormula],
	);

	const handleFormulaChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setFormula(event.target.value);
		},
		[setFormula],
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

	const handleRoundingDisabledChange = useCallback(
		(disabled: boolean) => {
			updateMarkdocTagAttributes(editor, pos, { round: disabled ? false : null });
		},
		[editor, pos],
	);

	const variableInsertHandlers = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const variable of availableVariables) {
			handlers[variable] = () => {
				insertVariable(variable);
			};
		}
		return handlers;
	}, [availableVariables, insertVariable]);

	const operatorInsertHandlers = useMemo<Record<string, () => void>>(() => {
		const handlers: Record<string, () => void> = {};
		for (const operator of CALC_OPERATORS) {
			handlers[operator] = () => {
				insertOperator(operator);
			};
		}
		return handlers;
	}, [insertOperator]);

	return (
		<div className="space-y-4">
			<CommonTagFields editor={editor} node={node} pos={pos} selectPrimary={selectPrimary} />
			{calcComponents.map((component, index) =>
				component.kind === "condition" && Array.isArray(component.primary) ? (
					<ConditionFields
						available={availableVariables}
						key={index}
						primary={component.primary}
						cases={component.cases}
						attributes={{ ...component }}
						update={(patch) =>
							updateMarkdocTagAttributes(editor, pos, {
								components: calcComponents.map((entry, i) =>
									i === index ? { ...entry, ...patch } : entry,
								),
							})
						}
					/>
				) : null,
			)}

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="calc-tag-formula">
					Formel
				</Label>
				<Textarea
					className="min-h-[72px] font-mono text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
					id="calc-tag-formula"
					onChange={handleFormulaChange}
					placeholder="z.B. [age] * 2 + [crp] * 3"
					ref={formulaInputRef}
					value={formulaValue}
				/>
				<p className="text-muted-foreground text-xs">
					Variablen in eckigen Klammern verwenden, z.B. <span className="font-mono">[age]</span>.
				</p>

				{parseError ? (
					<div className="flex items-start gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive text-xs">
						<AlertTriangle className="mt-0.5 h-3 w-3" />
						<span>Formel ist ungültig. Prüfe Klammern und Operatoren.</span>
					</div>
				) : null}
				{!parseError && formulaValue.trim() ? (
					<div className="flex items-center gap-1 text-solarized-green text-xs">
						<CheckCircle2 className="h-3 w-3" />
						<span>Formel sieht gültig aus.</span>
					</div>
				) : null}

				{parsedVariables.length > 0 && (
					<div className="space-y-1.5 pt-1">
						<Label className="font-medium text-xs">Enthaltene Werte</Label>
						<div className="flex flex-wrap gap-1.5">
							{parsedVariables.map((variable) =>
								computedVariables.has(variable) ? (
									<button
										className="rounded-md border border-solarized-orange/40 px-2 py-1 text-xs text-solarized-orange hover:bg-solarized-orange/10"
										key={variable}
										type="button"
										title="Berechneter Wert – ursprüngliche Berechnung öffnen"
										onClick={() => {
											const target = computedVariables.get(variable);
											if (target !== undefined) {
												editor.chain().focus().setNodeSelection(target).scrollIntoView().run();
											}
										}}
									>
										[{variable}] · berechnet ↗
									</button>
								) : (
									<span
										className="rounded-full border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-0.5 font-mono text-[11px] text-solarized-orange"
										key={variable}
									>
										[{variable}]
									</span>
								),
							)}
						</div>
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label className="font-medium text-xs">Schnell einfügen</Label>
				<div className="flex flex-wrap gap-1.5">
					{availableVariables.length > 0 ? (
						availableVariables.map((variable) => (
							<button
								className="inline-flex items-center rounded-full border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-0.5 font-mono text-[11px] text-solarized-orange transition hover:border-solarized-orange/50 hover:bg-solarized-orange/15"
								key={variable}
								onClick={variableInsertHandlers[variable]}
								type="button"
							>
								[{variable}]
							</button>
						))
					) : (
						<span className="text-muted-foreground text-xs">Noch keine Variablen im Dokument.</span>
					)}
				</div>
				<div className="flex flex-wrap gap-1.5">
					{CALC_OPERATORS.map((operator) => (
						<button
							className="inline-flex items-center rounded-md border border-solarized-orange/20 bg-background px-2 py-0.5 font-mono text-[11px] text-foreground transition hover:border-solarized-orange/40 hover:bg-solarized-orange/5"
							key={operator}
							onClick={operatorInsertHandlers[operator]}
							type="button"
						>
							{operator}
						</button>
					))}
				</div>
			</div>

			<Separator />

			<div className="space-y-3">
				<div>
					<Label className="font-medium text-xs">Anzeige und gemeinsames Ergebnis</Label>
					<p className="text-muted-foreground text-xs">
						Die Rundung gilt auch für abhängige Werte und muss bei gleichnamigen Berechnungen
						übereinstimmen. Die Einheitenanzeige bleibt lokal.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={node.attrs.renderUnit === true}
						id="calc-tag-render-unit"
						onCheckedChange={(checked) => {
							handleRenderUnitChange(checked === true);
						}}
					/>
					<Label className="font-normal text-xs" htmlFor="calc-tag-render-unit">
						Einheit im Dokument anzeigen
					</Label>
				</div>
				<div className="space-y-1.5">
					<Label className="font-normal text-xs" htmlFor="calc-tag-round">
						Nachkommastellen
					</Label>
					<Input
						className="h-8 text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
						disabled={node.attrs.round === false}
						id="calc-tag-round"
						max={100}
						min={0}
						onChange={handleRoundChange}
						placeholder="2 (Standard)"
						step={1}
						type="number"
						value={typeof node.attrs.round === "number" ? node.attrs.round : ""}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={node.attrs.round === false}
						id="calc-tag-round-disabled"
						onCheckedChange={(checked) => {
							handleRoundingDisabledChange(checked === true);
						}}
					/>
					<Label className="font-normal text-xs" htmlFor="calc-tag-round-disabled">
						Nicht runden
					</Label>
				</div>
			</div>
		</div>
	);
};
