"use client";

import { cn } from "@repo/design-system/lib/utils";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { InputSource } from "../inputs/inputs";
import { SOURCE_LABELS } from "./field-details";
import { isPhoneLayout } from "./shared";
import {
	tagFocusSelector,
	focusAdjacentTag,
	toggleDetailsEvent,
	closeDetailsEvent,
} from "./tag-popover";

// Bar buttons must not take focus from the field, or the keyboard would close.
// Only the mouse event: Safari drops the click after a cancelled pointerdown.
const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();
/**
 * On phones, a bar docked at the top of the template card names the field being
 * typed and moves to the previous or next tag; the field's details open from its ⓘ.
 * Docked there, it stays clear of the keyboard and of Safari's bottom address bar.
 */
export const InlineKeyboardBar = () => {
	// The focused tag's own control: a text field, a selection, a calculation or a condition.
	const [field, setField] = useState<HTMLElement | null>(null);

	useEffect(() => {
		if (!isPhoneLayout()) {
			return;
		}
		const handleFocusIn = (event: FocusEvent) => {
			const { target } = event;
			// Controls inside an open tag's details keep the bar on that tag.
			if (target instanceof HTMLElement && target.matches(tagFocusSelector)) {
				setField(target);
			}
		};
		const handleFocusOut = (event: FocusEvent) => {
			const next = event.relatedTarget as Element | null;
			if (!next?.closest(`[data-inline-keyboard-bar], [data-inline-panel], ${tagFocusSelector}`)) {
				setField(null);
			}
		};
		document.addEventListener("focusin", handleFocusIn);
		document.addEventListener("focusout", handleFocusOut);
		return () => {
			document.removeEventListener("focusin", handleFocusIn);
			document.removeEventListener("focusout", handleFocusOut);
		};
	}, []);

	const slot = field ? document.querySelector("[data-inline-keyboard-slot]") : null;
	if (!field || !slot) {
		return null;
	}
	const tag = field.closest<HTMLElement>("[data-markdoc-input]");
	const label = field.dataset.inlineInput ?? tag?.dataset.tagTitle;
	const source = field.dataset.source ? SOURCE_LABELS[field.dataset.source as InputSource] : null;
	const barButtonClassName =
		"inline-flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-solarized-blue active:bg-muted";

	return createPortal(
		<div
			className="flex touch-manipulation items-center gap-1 border-b bg-muted px-2 py-1 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
			data-inline-keyboard-bar
		>
			<span className="min-w-0 truncate font-semibold">{label}</span>
			{field.dataset.unit ? (
				<span className="shrink-0 text-muted-foreground">{field.dataset.unit}</span>
			) : null}
			{source ? (
				<span className={cn("inline-flex shrink-0", source.className)} title={source.label}>
					<source.icon aria-hidden className="h-4 w-4" />
					<span className="sr-only">{source.label}</span>
				</span>
			) : null}
			<button
				aria-label="Details anzeigen"
				className={barButtonClassName}
				onClick={() => tag?.dispatchEvent(new Event(toggleDetailsEvent))}
				onMouseDown={keepFocus}
				type="button"
			>
				<Info aria-hidden className="h-4 w-4" />
			</button>
			<span className="ml-auto" />
			<button
				aria-label="Vorheriges Feld"
				className={barButtonClassName}
				onClick={() => focusAdjacentTag(field, -1)}
				onMouseDown={keepFocus}
				type="button"
			>
				<ChevronLeft aria-hidden className="h-5 w-5" />
			</button>
			<button
				aria-label="Nächstes Feld"
				className={barButtonClassName}
				onClick={() => focusAdjacentTag(field, 1)}
				onMouseDown={keepFocus}
				type="button"
			>
				<ChevronRight aria-hidden className="h-5 w-5" />
			</button>
			<button
				className={cn(barButtonClassName, "font-semibold")}
				onClick={() => {
					tag?.dispatchEvent(new Event(closeDetailsEvent));
					field.blur();
					(document.activeElement as HTMLElement | null)?.blur();
				}}
				onMouseDown={keepFocus}
				type="button"
			>
				Fertig
			</button>
		</div>,
		slot,
	);
};
