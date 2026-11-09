"use client";

/* oxlint-disable eslint/no-nested-ternary */

import type { DateValue } from "@internationalized/date";
import { Calendar } from "@repo/design-system/components/ui/calendar-rac";
import { cn } from "@repo/design-system/lib/utils";
import { Info } from "lucide-react";
import { useInfoTag, useMarkdocInteraction } from "markdoc-md/react";
import type { InfoProps } from "markdoc-md/react";
import type { CSSProperties } from "react";
import { useRef } from "react";
import { I18nProvider } from "react-aria-components";

import {
	formatDateGerman,
	getDateShortcut,
	normalizeDateValue,
	parseDateInput,
} from "../inputs/ui/date-utils";
import { hasFieldActions, FieldDetails } from "./field-details";
import { useLayoutValue, useFieldState } from "./field-state";
import {
	chipFieldPress,
	touchInputClassName,
	parseNumberDraft,
	useDraft,
	useFrozenWidth,
} from "./shared";
import { TagPopover } from "./tag-popover";

/**
 * Digits typed for a date get their separators: 03112026 becomes 03.11.2026.
 * Deleting, and dates typed with their own separators like 3.11.2026, stay as typed.
 */
const formatDateDraft = (draft: string, previous: string) => {
	if (draft.length < previous.length || !/^(\d{2}\.){0,2}\d*$/.test(draft)) {
		return draft;
	}
	const digits = draft.replaceAll(".", "").slice(0, 8);
	return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
		.filter(Boolean)
		.join(".")
		.concat(digits.length === 2 || digits.length === 4 ? "." : "");
};
export const InlineInfo = (props: InfoProps) => {
	const { name, value, display, contract } = useInfoTag(props);
	const { activeTagName, onVariableChange } = useMarkdocInteraction();
	const isNumber = contract?.domain === "number" || props.type === "number";
	const isDate = contract?.domain === "date" || props.type === "date";
	const field = useDraft(useLayoutValue(value));
	const { state } = useFieldState(name);
	const width = useFrozenWidth();
	// A click places the caret; reaching the field by keyboard selects its text.
	const isPointerFocusRef = useRef(false);
	const unitText = props.renderUnit && props.unit ? ` ${props.unit}` : "";
	if (!name || !onVariableChange) {
		return (
			<>
				{display}
				{unitText}
			</>
		);
	}
	const text = field.draft;
	const description = props.description ?? contract?.description;
	const unit = props.unit ?? contract?.unit;
	const placeholder = isDate ? "TT.MM.JJJJ" : name;
	const dateValue = isDate ? parseDateInput(value) : null;

	return (
		<TagPopover
			citations={state?.citations}
			icon={<Info aria-hidden className="h-3.5 w-3.5 shrink-0" />}
			interactive={isDate || hasFieldActions(state, value)}
			isActive={activeTagName === name}
			kind="info"
			name={name}
			title={name}
			trigger={({ className, isOpen, onFocus, panelId }) => (
				// oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Pointer users can hit the whole chip; keyboard users reach the input itself.
				<span
					className={cn(className, "cursor-text")}
					onClick={(event) => {
						isPointerFocusRef.current = true;
						chipFieldPress.onClick(event);
					}}
					onMouseDown={chipFieldPress.onMouseDown}
				>
					<input
						aria-describedby={isOpen ? panelId : undefined}
						aria-label={name}
						className={cn(
							// Fit the text; browsers without field-sizing use a character estimate.
							"inline-block w-(--field-width) min-w-[2ch] max-w-full border-0 bg-transparent p-0 text-inherit outline-none [field-sizing:content] placeholder:text-solarized-blue/50 [font:inherit] supports-[field-sizing:content]:w-auto",
							touchInputClassName,
							// The keyboard bar on touch devices covers the bottom of the viewport.
							"pointer-coarse:scroll-mb-24",
						)}
						data-inline-input={name}
						data-source={state?.source}
						data-tag-focus
						data-unit={unit}
						inputMode={isNumber ? "decimal" : isDate ? "numeric" : undefined}
						onBlur={() => {
							// Dates are stored like the side date picker stores them.
							const normalized = isDate ? normalizeDateValue(field.draft) : undefined;
							if (normalized && normalized !== field.draft) {
								onVariableChange(name, normalized);
							}
							field.endEditing();
							width.release();
							isPointerFocusRef.current = false;
						}}
						onChange={(event) => {
							const next = isDate
								? formatDateDraft(event.target.value, field.draft)
								: event.target.value;
							field.setDraft(next);
							if (!isNumber) {
								onVariableChange(name, next);
								return;
							}
							const parsed = parseNumberDraft(next);
							if (parsed !== null) {
								onVariableChange(name, parsed);
							}
						}}
						onFocus={(event) => {
							const input = event.currentTarget;
							width.freeze(input);
							onFocus();
							if (!isPointerFocusRef.current) {
								// Safari does not always select a field reached with Tab.
								requestAnimationFrame(() => {
									if (document.activeElement === input) {
										input.select();
									}
								});
							}
							isPointerFocusRef.current = false;
						}}
						onPointerDown={() => {
							isPointerFocusRef.current = true;
						}}
						// h, g and m type heute, gestern and morgen.
						onKeyDown={(event) => {
							const shortcut = isDate ? getDateShortcut(event) : null;
							if (shortcut) {
								event.preventDefault();
								const next = formatDateGerman(shortcut);
								field.setDraft(next);
								onVariableChange(name, next);
							}
						}}
						placeholder={placeholder}
						style={
							{
								"--field-width": `${(text || placeholder).length + 1}ch`,
								...width.style,
							} as CSSProperties
						}
						type="text"
						value={text}
					/>
					{/* A real space keeps the unit separate in copied text. */}
					{props.renderUnit && props.unit ? (
						<>
							{" "}
							<span className="text-[0.85em]">{props.unit}</span>
						</>
					) : null}
				</span>
			)}
			unit={unit}
		>
			{() => (
				<>
					{description ? (
						<p className="mt-1.5 text-muted-foreground text-xs leading-normal">{description}</p>
					) : null}
					{isDate ? (
						<I18nProvider locale="de-DE">
							<Calendar
								aria-label={`${name} im Kalender wählen`}
								className="mt-2 -mx-1"
								defaultFocusedValue={dateValue ?? undefined}
								onChange={(date) => {
									field.endEditing();
									onVariableChange(name, formatDateGerman(date as DateValue));
								}}
								value={dateValue}
							/>
						</I18nProvider>
					) : null}
					<FieldDetails name={name} unit={unit} value={value} />
				</>
			)}
		</TagPopover>
	);
};
