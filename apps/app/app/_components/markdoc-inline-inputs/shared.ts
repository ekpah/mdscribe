import { cn } from "@repo/design-system/lib/utils";
import type { VariableValue } from "markdoc-md/react";
import type { CSSProperties, MouseEvent } from "react";
import { useState } from "react";

export type TagKind = "calc" | "condition" | "info" | "select";
/** What a calculation shows until all of its inputs are filled in, as in markdoc-md. */
export const CALC_PLACEHOLDER = "…";
// Safari zooms into inputs below 16px on focus; keep them readable without disabling pinch zoom.
export const touchInputClassName = "pointer-coarse:text-base";
export const isCoarsePointer = () =>
	typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
/**
 * Phones get the bar above the keyboard; tablets have room for the same
 * information popovers as desktops.
 */
export const isPhoneLayout = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(pointer: coarse) and (max-width: 767px)").matches;
export const fieldClassName = (kind: TagKind, isOpen: boolean, isActive: boolean) =>
	cn(
		// Tags are tapped in quick succession; Safari would read two taps as a double-tap zoom.
		"touch-manipulation rounded border border-transparent px-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
		kind === "info" &&
			"whitespace-nowrap border-b-solarized-blue/40 bg-solarized-blue/10 text-solarized-blue",
		kind === "select" &&
			"cursor-pointer border-b-solarized-cyan/40 bg-solarized-cyan/10 text-solarized-cyan",
		kind === "condition" &&
			"cursor-pointer border-b-solarized-yellow/50 border-dashed bg-solarized-yellow/10 text-solarized-yellow",
		kind === "calc" &&
			"inline-block cursor-pointer whitespace-nowrap border-b-solarized-violet/40 bg-solarized-violet/10 text-solarized-violet",
		isOpen && kind === "info" && "border-solarized-blue ring-2 ring-solarized-blue/15",
		isOpen && kind === "select" && "border-solarized-cyan ring-2 ring-solarized-cyan/15",
		isOpen && kind === "condition" && "border-solarized-yellow ring-2 ring-solarized-yellow/15",
		isOpen && kind === "calc" && "border-solarized-violet ring-2 ring-solarized-violet/15",
		!isOpen && isActive && "border-solarized-orange/70 ring-2 ring-solarized-orange/35",
	);
export const parseNumberDraft = (draft: string): VariableValue | null => {
	if (!draft.trim()) {
		return "";
	}
	const value = Number(draft.replace(",", "."));
	return Number.isNaN(value) ? null : value;
};
/**
 * Keeps the typed text while a field is edited. Values return through the
 * shared field state one render later, which would otherwise reset the caret
 * and drop fast keystrokes; number fields also keep partial input such as "1,".
 */
export const useDraft = (value: VariableValue) => {
	const [draft, setDraft] = useState<string | null>(null);
	return {
		draft: draft ?? (value === undefined || value === null ? "" : String(value)),
		endEditing: () => setDraft(null),
		setDraft,
	};
};
/** Pins a field's width while it is edited, so the text around it does not move. */
export const useFrozenWidth = () => {
	const [width, setWidth] = useState<number | null>(null);
	return {
		freeze: (element: HTMLElement) => setWidth(element.getBoundingClientRect().width),
		release: () => setWidth(null),
		style: width === null ? {} : ({ fieldSizing: "fixed", width } as CSSProperties),
	};
};
/**
 * A press anywhere on a field's chip, such as its unit or padding, edits the
 * field: the caret goes to the end. Spread onto the chip around the input.
 */
export const chipFieldPress = {
	onClick: (event: MouseEvent<HTMLElement>) => {
		const field = event.currentTarget.querySelector<HTMLInputElement>("input[data-tag-focus]");
		if (!field || event.target === field || document.activeElement === field) {
			return;
		}
		field.focus();
		field.setSelectionRange(field.value.length, field.value.length);
	},
	// Keep focus where it is until the click, so an edited field does not blur and refocus.
	onMouseDown: (event: MouseEvent<HTMLElement>) => {
		if (!(event.target instanceof HTMLInputElement)) {
			event.preventDefault();
		}
	},
};
