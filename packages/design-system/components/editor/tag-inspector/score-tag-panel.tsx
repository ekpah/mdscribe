"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import Formula from "fparser";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

const SCORE_OPERATORS = ["+", "-", "*", "/", "(", ")"] as const;

export const ScoreTagPanel = ({
	editor,
	node,
	pos,
}: {
	editor: Editor;
	node: ProseMirrorNode;
	pos: number;
}) => {
	const formulaValue = node.attrs.formula ?? "";
	const unitValue = node.attrs.unit ?? "";
	const formulaInputRef = useRef<HTMLTextAreaElement>(null);
	const datalistId = useId();
	const [availableVariables, setAvailableVariables] = useState<string[]>([]);
	const [newTerm, setNewTerm] = useState({ variable: "", weight: "" });

	useEffect(() => {
		const updateVariables = () => {
			const variables = new Set<string>();
			editor.state.doc.descendants((docNode) => {
				if (docNode.type.name === "infoTag" && docNode.attrs.primary) {
					variables.add(docNode.attrs.primary);
				}
			});
			setAvailableVariables([...variables].toSorted());
		};

		updateVariables();
		editor.on("update", updateVariables);

		return () => {
			editor.off("update", updateVariables);
		};
	}, [editor]);

	const { parsedVariables, parseError } = useMemo(() => {
		if (!formulaValue.trim()) {
			return { parseError: null as Error | null, parsedVariables: [] };
		}

		try {
			const formula = new Formula(formulaValue);
			return {
				parseError: null,
				parsedVariables: formula.getVariables(),
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
			updateMarkdocTagAttributes(editor, pos, { formula });
		},
		[editor, pos],
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

	const handleAddTerm = useCallback(() => {
		const variable = newTerm.variable.trim().replaceAll(/^\[|\]$/g, "");
		if (!variable) {
			return;
		}

		const weight = newTerm.weight.trim();
		const normalizedWeight = weight === "" || weight === "1" ? "" : weight;
		const term = normalizedWeight ? `${normalizedWeight} * [${variable}]` : `[${variable}]`;

		const current = formulaValue.trim();
		setFormula(current ? `${current} + ${term}` : term);
		setNewTerm({ variable: "", weight: "" });

		requestAnimationFrame(() => {
			formulaInputRef.current?.focus();
		});
	}, [formulaValue, newTerm, setFormula]);

	const handleFormulaChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setFormula(event.target.value);
		},
		[setFormula],
	);

	const handleUnitChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			updateMarkdocTagAttributes(editor, pos, { unit: event.target.value || null });
		},
		[editor, pos],
	);

	const handleNewTermVariableChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewTerm((prev) => ({ ...prev, variable: event.target.value }));
	}, []);

	const handleNewTermWeightChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNewTerm((prev) => ({ ...prev, weight: event.target.value }));
	}, []);

	const handleNewTermKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter" && newTerm.variable.trim()) {
				event.preventDefault();
				handleAddTerm();
			}
		},
		[handleAddTerm, newTerm.variable],
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
		for (const operator of SCORE_OPERATORS) {
			handlers[operator] = () => {
				insertOperator(operator);
			};
		}
		return handlers;
	}, [insertOperator]);

	return (
		<div className="space-y-4">
			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="score-tag-formula">
					Formel
				</Label>
				<Textarea
					className="min-h-[72px] font-mono text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
					id="score-tag-formula"
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
					<div className="flex flex-wrap gap-1.5 pt-1">
						{parsedVariables.map((variable) => (
							<span
								className="rounded-full border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-0.5 font-mono text-[11px] text-solarized-orange"
								key={variable}
							>
								[{variable}]
							</span>
						))}
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
						<span className="text-muted-foreground text-xs">
							Noch keine Info-Variablen im Dokument.
						</span>
					)}
				</div>
				<div className="flex flex-wrap gap-1.5">
					{SCORE_OPERATORS.map((operator) => (
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

			<div className="space-y-2">
				<Label className="font-medium text-xs">Komponente hinzufügen</Label>
				<div className="grid grid-cols-3 gap-2">
					<Input
						className="h-8 font-mono text-xs focus:border-solarized-orange focus:ring-solarized-orange/50"
						list={datalistId}
						onChange={handleNewTermVariableChange}
						onKeyDown={handleNewTermKeyDown}
						placeholder="Variable"
						value={newTerm.variable}
					/>
					<Input
						className="h-8 text-xs focus:border-solarized-orange focus:ring-solarized-orange/50"
						inputMode="decimal"
						onChange={handleNewTermWeightChange}
						onKeyDown={handleNewTermKeyDown}
						placeholder="Gewicht (z.B. 2)"
						value={newTerm.weight}
					/>
					<Button
						className="h-8 text-xs"
						disabled={!newTerm.variable.trim()}
						onClick={handleAddTerm}
						size="sm"
						variant="secondary"
					>
						<Plus className="h-3.5 w-3.5" />
						Hinzufügen
					</Button>
				</div>
				<datalist id={datalistId}>
					{availableVariables.map((variable) => (
						<option key={variable} value={variable} />
					))}
				</datalist>
			</div>

			<div className="space-y-1.5">
				<Label className="font-medium text-xs" htmlFor="score-tag-unit">
					Einheit (optional)
				</Label>
				<Input
					className="h-8 text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
					id="score-tag-unit"
					onChange={handleUnitChange}
					placeholder="z.B. kg, mm, °C, Punkte"
					value={unitValue}
				/>
			</div>
		</div>
	);
};
