"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { MemberCondition } from "../tiptap-extension/editorNodes/case-condition";
import {
	CASE_CONDITION_KEYS as operators,
	formatCaseConditionLabel,
	getMemberCondition,
	setMemberCondition,
} from "../tiptap-extension/editorNodes/case-condition";
import type { SwitchCase } from "../tiptap-extension/editorNodes/case-items";

type Comparison = "any" | "eq" | "gt" | "gte" | "lt" | "lte" | "range";

const COMPARISON_LABELS: Record<Comparison, string> = {
	any: "beliebig",
	eq: "gleich",
	gt: "größer als",
	gte: "mindestens",
	lt: "kleiner als",
	lte: "höchstens",
	range: "Bereich",
};

const comparisonOf = (condition: MemberCondition): Comparison => {
	if (condition.eq !== undefined) {
		return "eq";
	}
	const lower = condition.gt !== undefined ? "gt" : condition.gte !== undefined ? "gte" : null;
	const upper = condition.lt !== undefined ? "lt" : condition.lte !== undefined ? "lte" : null;
	if (lower && upper) {
		return "range";
	}
	return lower ?? upper ?? "any";
};

/**
 * Switches a member to another comparison, keeping its value. A new range
 * starts inclusive on both ends (`gte`/`lte`), so it is never empty.
 */
const withComparison = (condition: MemberCondition, comparison: Comparison): MemberCondition => {
	const value = Object.values(condition).find((bound) => bound !== undefined) ?? 0;
	if (comparison === "any") {
		return {};
	}
	if (comparison === "range") {
		return { gte: value, lte: value };
	}
	return { [comparison]: value };
};

/** A number input that commits valid numbers while typing and restores the value on blur. */
const BoundInput = ({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number | undefined;
	onChange: (value: number) => void;
}) => {
	const [draft, setDraft] = useState(String(value ?? ""));
	useEffect(() => setDraft(String(value ?? "")), [value]);
	return (
		<Input
			aria-label={label}
			className="h-8 text-sm"
			inputMode="decimal"
			onBlur={() => setDraft(String(value ?? ""))}
			onChange={(event) => {
				setDraft(event.target.value);
				const next = Number(event.target.value.replace(",", "."));
				if (event.target.value.trim() && Number.isFinite(next)) {
					onChange(next);
				}
			}}
			value={draft}
		/>
	);
};

const selectClassName = "h-8 w-full min-w-0 rounded-md border bg-background px-2 text-xs";

const MemberComparison = ({
	caseLabel,
	name,
	condition,
	onChange,
}: {
	caseLabel: string;
	name: string;
	condition: MemberCondition;
	onChange: (condition: MemberCondition) => void;
}) => {
	const comparison = comparisonOf(condition);
	const lowerKey = condition.gt !== undefined ? "gt" : "gte";
	const upperKey = condition.lte !== undefined ? "lte" : "lt";
	const label = `${caseLabel} ${name}`;
	return (
		<div className="space-y-1.5">
			<div className="flex items-center gap-1.5">
				<span className="w-16 shrink-0 truncate font-mono text-xs" title={name}>
					{name}
				</span>
				<select
					aria-label={`${label} Vergleich`}
					className={selectClassName}
					value={comparison}
					onChange={(event) =>
						onChange(withComparison(condition, event.target.value as Comparison))
					}
				>
					{(Object.keys(COMPARISON_LABELS) as Comparison[]).map((key) => (
						<option key={key} value={key}>
							{COMPARISON_LABELS[key]}
						</option>
					))}
				</select>
				{comparison !== "any" && comparison !== "range" && (
					<div className="w-20 shrink-0">
						<BoundInput
							label={`${label} Wert`}
							value={condition[comparison]}
							onChange={(value) => onChange({ [comparison]: value })}
						/>
					</div>
				)}
			</div>
			{comparison === "range" && (
				<div className="ml-[4.375rem] grid grid-cols-[minmax(0,1fr)_5rem] gap-1.5">
					<select
						aria-label={`${label} Untergrenze`}
						className={selectClassName}
						value={lowerKey}
						onChange={(event) =>
							onChange({
								[event.target.value]: condition[lowerKey],
								[upperKey]: condition[upperKey],
							})
						}
					>
						<option value="gt">größer als</option>
						<option value="gte">mindestens</option>
					</select>
					<BoundInput
						label={`${label} Untergrenze Wert`}
						value={condition[lowerKey]}
						onChange={(value) => onChange({ ...condition, [lowerKey]: value })}
					/>
					<select
						aria-label={`${label} Obergrenze`}
						className={selectClassName}
						value={upperKey}
						onChange={(event) =>
							onChange({
								[lowerKey]: condition[lowerKey],
								[event.target.value]: condition[upperKey],
							})
						}
					>
						<option value="lt">kleiner als</option>
						<option value="lte">höchstens</option>
					</select>
					<BoundInput
						label={`${label} Obergrenze Wert`}
						value={condition[upperKey]}
						onChange={(value) => onChange({ ...condition, [upperKey]: value })}
					/>
				</div>
			)}
		</div>
	);
};

/**
 * Settings of a condition: the compared fields and each case's comparisons.
 * Case content is edited inline in the document's case tabs. Cases are
 * positional (one bound per field); the caller converts scalar conditions.
 */
export const ConditionFields = ({
	primary,
	cases,
	attributes,
	available,
	update,
}: {
	primary: string[];
	cases: SwitchCase[];
	attributes: Record<string, unknown>;
	/** Numeric variables of the document that can be added as fields. */
	available: readonly string[];
	update: (patch: Record<string, unknown>) => void;
}) => {
	const id = useId();
	const [newField, setNewField] = useState("");
	const [blocked, setBlocked] = useState(false);
	const changeCase = (index: number, patch: Partial<SwitchCase>) =>
		update({ cases: cases.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

	/** Rebuilds fields and every positional bound together, so bounds stay aligned. */
	const restructure = (indices: (number | null)[], names: string[]) => {
		const nextCases = cases.map((item) => {
			const next = { ...item };
			for (const key of operators) {
				const bounds = item[key];
				if (Array.isArray(bounds)) {
					next[key] = indices.map((index) => (index === null ? null : (bounds[index] ?? null)));
				}
			}
			return next;
		});
		const losesCondition = nextCases.some(
			(item) =>
				!item.isDefault &&
				!operators.some(
					(key) => Array.isArray(item[key]) && item[key].some((value) => value !== null),
				),
		);
		setBlocked(losesCondition);
		if (!losesCondition) {
			update({ cases: nextCases, primary: names });
		}
	};
	const addField = (name: string) => {
		if (!name || primary.includes(name)) {
			return;
		}
		restructure([...primary.map((_, index) => index), null], [...primary, name]);
		setNewField("");
	};
	const suggestions = available.filter((name) => !primary.includes(name));

	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-xs">
				Fall-Texte links in den Fall-Tabs bearbeiten. Alle Vergleiche eines Falls müssen zutreffen;
				der erste passende Fall wird angezeigt.
			</p>

			<div className="space-y-2">
				<Label className="font-medium text-xs">Verglichene Felder</Label>
				{primary.map((name, index) => (
					<div className="flex items-center gap-1" key={index}>
						<Input
							aria-label={`Feld ${index + 1}`}
							className="h-8 font-mono text-sm"
							value={name}
							onChange={(event) =>
								update({
									primary: primary.map((value, i) => (i === index ? event.target.value : value)),
								})
							}
						/>
						<Button
							aria-label={`Feld ${index + 1} nach oben`}
							disabled={index === 0}
							size="icon"
							variant="ghost"
							onClick={() => {
								const order = primary.map((_, i) => i);
								[order[index - 1], order[index]] = [index, index - 1];
								restructure(
									order,
									order.map((i) => primary[i] ?? ""),
								);
							}}
						>
							<ArrowUp aria-hidden="true" />
						</Button>
						<Button
							aria-label={`Feld ${index + 1} entfernen`}
							disabled={primary.length === 1}
							size="icon"
							variant="ghost"
							onClick={() => {
								if (
									!window.confirm(`Feld „${name}“ mit allen zugeordneten Vergleichen entfernen?`)
								) {
									return;
								}
								const order = primary.map((_, i) => i).filter((i) => i !== index);
								restructure(
									order,
									order.map((i) => primary[i] ?? ""),
								);
							}}
						>
							<X aria-hidden="true" />
						</Button>
					</div>
				))}
				{blocked && (
					<p className="text-destructive text-xs">
						Zuerst den Fall ändern oder entfernen, der dadurch keine Bedingung mehr hätte.
					</p>
				)}
				{suggestions.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{suggestions.map((name) => (
							<button
								className="inline-flex items-center rounded-full border border-solarized-cyan/20 bg-solarized-cyan/10 px-2 py-0.5 font-mono text-[11px] text-solarized-cyan transition hover:border-solarized-cyan/50 hover:bg-solarized-cyan/15"
								key={name}
								onClick={() => addField(name)}
								title="Als Feld vergleichen"
								type="button"
							>
								+ {name}
							</button>
						))}
					</div>
				)}
				<div className="flex gap-1">
					<Input
						aria-label="Neues Feld"
						className="h-8 font-mono text-sm"
						onChange={(event) => setNewField(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addField(newField.trim());
							}
						}}
						placeholder="Neues Feld"
						value={newField}
					/>
					<Button
						disabled={!newField.trim()}
						size="sm"
						variant="outline"
						onClick={() => addField(newField.trim())}
					>
						Feld hinzufügen
					</Button>
				</div>
				{primary.length === 1 && Array.isArray(attributes.primary) && (
					<Button
						size="sm"
						variant="ghost"
						onClick={() =>
							update({
								cases: cases.map((item) => ({
									...item,
									...Object.fromEntries(
										operators.map((key) => [
											key,
											Array.isArray(item[key]) ? (item[key][0] ?? undefined) : item[key],
										]),
									),
								})),
								primary: primary[0],
							})
						}
					>
						Als einzelnes Feld speichern
					</Button>
				)}
			</div>

			<Separator />

			<div className="space-y-2">
				<Label className="font-medium text-xs">Fälle ({cases.length})</Label>
				{cases.map((item, index) => {
					const caseLabel = `Fall ${index + 1}`;
					return (
						<div className="space-y-2 rounded-md border p-2.5" key={index}>
							<div className="flex items-center justify-between gap-2">
								<span className="truncate font-medium text-xs">
									{caseLabel}
									<span className="font-normal text-muted-foreground">
										{" · "}
										{formatCaseConditionLabel(item, primary) ?? "ohne Bedingung"}
									</span>
								</span>
								<Button
									aria-label={`${caseLabel} entfernen`}
									size="icon"
									variant="ghost"
									onClick={() => update({ cases: cases.filter((_, i) => i !== index) })}
								>
									<Trash2 aria-hidden="true" />
								</Button>
							</div>
							{!item.isDefault &&
								primary.map((name, member) => (
									<MemberComparison
										caseLabel={caseLabel}
										condition={getMemberCondition(item, member)}
										key={member}
										name={name || `Feld ${member + 1}`}
										onChange={(condition) =>
											update({
												cases: cases.map((entry, i) =>
													i === index
														? setMemberCondition(entry, member, primary.length, condition)
														: entry,
												),
											})
										}
									/>
								))}
							<div className="flex items-center gap-2">
								<Checkbox
									checked={Boolean(item.isDefault)}
									id={`${id}-default-${index}`}
									onCheckedChange={(checked) =>
										changeCase(index, {
											isDefault: checked === true,
											...Object.fromEntries(operators.map((key) => [key, undefined])),
										})
									}
								/>
								<Label className="font-normal text-xs" htmlFor={`${id}-default-${index}`}>
									Sonst-Fall (wenn kein vorheriger Fall passt)
								</Label>
							</div>
						</div>
					);
				})}
				<Button
					className="w-full"
					size="sm"
					variant="outline"
					onClick={() => {
						const added: SwitchCase = {
							content: "",
							gt: primary.map((_, member) => (member === 0 ? 0 : null)),
							primary: "",
							text: "",
						};
						// A new case goes before a trailing fallback, which must stay last.
						const fallback = cases.at(-1)?.isDefault ? cases.length - 1 : cases.length;
						update({ cases: cases.toSpliced(fallback, 0, added) });
					}}
				>
					<Plus aria-hidden="true" /> Fall hinzufügen
				</Button>
			</div>

			<Separator />

			<div className="space-y-3">
				{(
					[
						["description", "Beschreibung (optional)"],
						["unit", "Einheit (optional)"],
						...(Array.isArray(attributes.primary) ? [] : [["source", "Quelle (optional)"]]),
					] as const
				).map(([key, label]) => (
					<div className="space-y-1.5" key={key}>
						<Label className="font-medium text-xs" htmlFor={`${id}-${key}`}>
							{label}
						</Label>
						<Input
							className="h-8 text-sm"
							id={`${id}-${key}`}
							value={String(attributes[key] ?? "")}
							onChange={(event) => update({ [key]: event.target.value || null })}
						/>
					</div>
				))}
				{Array.isArray(attributes.primary) && (
					<p className="text-muted-foreground text-xs">
						Bei mehreren Feldern beschreiben Beschreibung und Einheit nur diese Bedingung; Quellen
						gehören an die einzelnen Felder.
					</p>
				)}
			</div>
		</div>
	);
};
