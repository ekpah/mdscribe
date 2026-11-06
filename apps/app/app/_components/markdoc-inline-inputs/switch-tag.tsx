"use client";

/* oxlint-disable eslint/no-nested-ternary */

import { cn } from "@repo/design-system/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { toBooleanValue } from "markdoc-md/parse";
import {
	useBranchTag,
	useMarkdocInteraction,
	useVariableContract,
	useVariables,
} from "markdoc-md/react";
import type { SwitchProps, VariableValue } from "markdoc-md/react";
import type { ReactNode } from "react";

import { FieldDetails } from "./field-details";
import { useLayoutValue, useFieldState } from "./field-state";
import { TagPopover } from "./tag-popover";

/** The visible chip of a switch or condition: the selected text, opened as a whole. */
export const BranchTrigger = ({
	className,
	icon,
	isOpen,
	label,
	onFocus,
	openPanel,
	panelId,
	ringClassName,
	selected,
}: {
	className: string;
	icon: ReactNode;
	isOpen: boolean;
	label: string;
	onFocus: () => void;
	openPanel: () => void;
	panelId: string;
	ringClassName: string;
	selected: ReactNode;
}) => (
	// The whole chip opens the options for pointer users. The accessible control
	// comes first, so Tab reaches it before fields nested in the selected case,
	// and nested inline fields never sit inside a button.
	// oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
	<span
		className={cn(className, ringClassName)}
		onClick={(event) => {
			// Nested fields stop their own clicks before they reach the chip.
			event.currentTarget
				.querySelector<HTMLElement>(":scope > button")
				?.focus({ preventScroll: true });
			openPanel();
		}}
	>
		<button
			aria-controls={isOpen ? panelId : undefined}
			aria-expanded={isOpen}
			aria-haspopup="dialog"
			aria-label={label}
			className="sr-only"
			data-tag-focus
			onClick={(event) => {
				event.stopPropagation();
				openPanel();
			}}
			onFocus={onFocus}
			// Safari skips buttons on Tab unless they set a tab index.
			tabIndex={0}
			type="button"
		/>
		{/* A pseudo-element placeholder stays out of copied text. */}
		{selected ?? <span className="opacity-70 before:content-['Auswählen…']" />}
		{icon}
	</span>
);
export const InlineSwitch = (props: SwitchProps) => {
	const { name, cases, selectedIndex, selected } = useBranchTag(props, "switch");
	const shownSelected = useLayoutValue(selected);
	const { activeTagName, onVariableChange } = useMarkdocInteraction();
	const contract = useVariableContract(name);
	const { state } = useFieldState(name);
	const values = useVariables();
	if (!name || !onVariableChange) {
		return selected;
	}
	const toValue = (primary?: string): VariableValue =>
		contract?.domain === "boolean" ? (toBooleanValue(primary) ?? primary) : (primary ?? "");
	const isCheckbox = contract?.domain === "boolean";
	const optionLabel = (primary?: string) =>
		isCheckbox ? (toBooleanValue(primary) ? "Ja" : "Nein") : (primary ?? "Standard");

	return (
		<TagPopover
			citations={state?.citations}
			icon={<ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0" />}
			isActive={activeTagName === name}
			kind="select"
			name={name}
			title={name}
			trigger={({ className, isOpen, onFocus, openPanel, panelId }) => (
				<BranchTrigger
					className={className}
					icon={<ChevronDown aria-hidden className="ml-0.5 inline h-3.5 w-3.5 align-[-0.15em]" />}
					isOpen={isOpen}
					label={`${name} auswählen`}
					onFocus={onFocus}
					openPanel={openPanel}
					panelId={panelId}
					ringClassName="has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-solarized-cyan"
					selected={shownSelected}
				/>
			)}
		>
			{(close) => (
				<>
					{(props.description ?? contract?.description) ? (
						<p className="mt-1.5 text-muted-foreground text-xs leading-normal">
							{props.description ?? contract?.description}
						</p>
					) : null}
					<fieldset aria-label={`${name} Optionen`} className="mt-2 flex flex-col gap-1">
						{cases.map((option, index) => (
							<button
								aria-pressed={selectedIndex === index}
								className={cn(
									"flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									selectedIndex === index &&
										"border-solarized-cyan/30 bg-solarized-cyan/10 text-solarized-cyan",
								)}
								data-option
								key={option.index ?? `${option.primary}-${index}`}
								onClick={() => {
									onVariableChange(name, toValue(option.primary));
									close();
								}}
								type="button"
							>
								<span className="[overflow-wrap:anywhere]">{optionLabel(option.primary)}</span>
								{selectedIndex === index ? (
									<Check aria-hidden className="h-4 w-4 shrink-0" />
								) : null}
							</button>
						))}
					</fieldset>
					<FieldDetails name={name} value={values[name]} />
				</>
			)}
		</TagPopover>
	);
};
