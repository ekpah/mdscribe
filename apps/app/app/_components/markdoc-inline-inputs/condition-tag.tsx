"use client";

import { cn } from "@repo/design-system/lib/utils";
import { Check, GitBranch } from "lucide-react";
import { parseConditionCase } from "markdoc-md/parse";
import type { CaseConditionOperator } from "markdoc-md/parse";
import { useBranchTag, useMarkdocInteraction } from "markdoc-md/react";
import type { SwitchProps } from "markdoc-md/react";
import { useEffect, useState } from "react";

import { DependencyField } from "./calc-tag";
import { useLayoutValue } from "./field-state";
import { BranchTrigger } from "./switch-tag";
import { TagPopover } from "./tag-popover";

const OPERATOR_SYMBOLS: Record<CaseConditionOperator, string> = {
	eq: "=",
	gt: ">",
	gte: "≥",
	lt: "<",
	lte: "≤",
};
/** A condition case as readable rules, evaluated by markdoc-md's case parser. */
const describeCase = (attributes: Record<string, unknown>, members: string[], primary: unknown) => {
	const parsed = parseConditionCase(attributes, primary);
	if (typeof parsed === "string") {
		return "Ungültige Regel";
	}
	if (parsed.default) {
		return "sonst";
	}
	return parsed.members
		.flatMap((condition, index) =>
			Object.entries(condition ?? {}).map(
				([operator, bound]) =>
					`${members[index]} ${OPERATOR_SYMBOLS[operator as CaseConditionOperator]} ${bound.toLocaleString("de-DE")}`,
			),
		)
		.join(" und ");
};
/**
 * Whether each member is typed in its own field in the text, such as a reading
 * that a condition grades. Tab then reaches those fields only; the condition
 * just shows what they decide.
 */
const useMembersInText = (members: string[]) => {
	const [chip, setChip] = useState<HTMLElement | null>(null);
	const [inText, setInText] = useState(false);
	const key = members.join("\n").toLowerCase();
	useEffect(() => {
		const text = chip?.closest("article");
		if (!text) {
			return;
		}
		const update = () => {
			const typed = new Set(
				[
					...text.querySelectorAll<HTMLInputElement>("input[data-inline-input][data-tag-focus]"),
				].map((field) => field.dataset.inlineInput?.toLowerCase()),
			);
			setInText(key.split("\n").every((member) => typed.has(member)));
		};
		update();
		// Switching a case can add or remove fields anywhere in the text.
		const observer = new MutationObserver(update);
		observer.observe(text, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, [chip, key]);
	return { inText, ref: setChip };
};
export const InlineCondition = (props: SwitchProps) => {
	const { name, cases, selectedIndex, selected } = useBranchTag(props, "condition");
	const shownSelected = useLayoutValue(selected);
	const { activeTagName, onVariableChange } = useMarkdocInteraction();
	const members = Array.isArray(props.primary) ? props.primary : [props.primary];
	const membersInText = useMembersInText(members);
	if (!onVariableChange || members.length === 0) {
		return selected;
	}
	const title = members.join(", ");

	return (
		<TagPopover
			icon={<GitBranch aria-hidden className="h-3.5 w-3.5 shrink-0" />}
			isActive={members.includes(activeTagName ?? "")}
			kind="condition"
			name={name ?? members[0] ?? ""}
			title={title}
			trigger={({ className, isOpen, onFocus, openPanel, panelId }) => (
				<BranchTrigger
					className={className}
					icon={null}
					isOpen={isOpen}
					label={`Bedingung ${title} anzeigen`}
					onFocus={onFocus}
					openPanel={openPanel}
					panelId={panelId}
					ref={membersInText.ref}
					ringClassName="has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-solarized-yellow"
					selected={shownSelected}
					tabStop={!membersInText.inText}
				/>
			)}
			unit={props.unit}
		>
			{() => (
				<>
					{props.description ? (
						<p className="mt-1.5 text-muted-foreground text-xs leading-normal">
							{props.description}
						</p>
					) : null}
					<div className="mt-2 divide-y border-y">
						{members.map((member) => (
							<DependencyField key={member} name={member} unit={props.unit} />
						))}
					</div>
					<ol aria-label="Fälle" className="mt-2 flex flex-col gap-1">
						{cases.map((option, index) => (
							<li
								aria-current={selectedIndex === index ? "true" : undefined}
								className={cn(
									"flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-muted-foreground",
									selectedIndex === index &&
										"border-solarized-yellow/40 bg-solarized-yellow/10 text-solarized-yellow",
								)}
								key={option.index ?? index}
							>
								<span className="[overflow-wrap:anywhere]">
									{describeCase(option as Record<string, unknown>, members, props.primary)}
								</span>
								{selectedIndex === index ? (
									<>
										<Check aria-hidden className="h-4 w-4 shrink-0" />
										<span className="sr-only">trifft zu</span>
									</>
								) : null}
							</li>
						))}
					</ol>
				</>
			)}
		</TagPopover>
	);
};
