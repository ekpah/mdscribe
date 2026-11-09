"use client";

/* oxlint-disable eslint/complexity -- TagPopover owns placement, dismissal and the keyboard model in one place. */

import { cn } from "@repo/design-system/lib/utils";
import { X } from "lucide-react";
import type { CitationRequest } from "markdoc-md/citations";
import { useMarkdocInteraction } from "markdoc-md/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useFieldState } from "./field-state";
import { fieldClassName, isCoarsePointer, isPhoneLayout } from "./shared";
import type { TagKind } from "./shared";

/** Every inline tag's own keyboard stop, in document order. */
export const tagFocusSelector = "[data-tag-focus]";
const panelFocusSelector =
	"button:not([disabled]):not([tabindex='-1']), input:not([disabled]), [tabindex='0']";
/**
 * Focuses the tag before or after `from` in document order; returns whether one
 * exists. Like native Tab, it skips tags taken out of the tab order.
 */
export const focusAdjacentTag = (from: Element, step: 1 | -1) => {
	const tags = [...document.querySelectorAll<HTMLElement>(tagFocusSelector)].filter(
		(tag) => tag === from || (tag.tabIndex >= 0 && tag.getClientRects().length > 0),
	);
	const next = tags[tags.indexOf(from as HTMLElement) + step];
	next?.focus();
	// Like native Tab, a reached field selects its text so typing replaces it.
	if (next instanceof HTMLInputElement) {
		next.select();
	}
	return Boolean(next);
};
export const toggleDetailsEvent = "inline-tag:toggle-details";
export const closeDetailsEvent = "inline-tag:close-details";
/**
 * Placement, dismissal and focus for one inline tag. Information tooltips only
 * show when they fit in full beside the visible field; dialogs scroll instead.
 */
export const TagPopover = ({
	children,
	citations,
	icon,
	isActive,
	kind,
	interactive = kind !== "info",
	name,
	openOnFocus = kind !== "info" || !isPhoneLayout(),
	title,
	trigger,
	unit,
}: {
	/** `close` returns focus to the tag; `moveOn` continues with the next tag. */
	children: (close: () => void, moveOn: () => void) => ReactNode;
	/** Sources of the current value; Cmd/Ctrl-click opens them, like in the side inputs. */
	citations?: CitationRequest[];
	icon: ReactNode;
	/** Info tooltips become interactive when they offer actions such as sources. */
	interactive?: boolean;
	isActive: boolean;
	kind: TagKind;
	name: string;
	/** On phones, an info field's details open from the keyboard bar instead. */
	openOnFocus?: boolean;
	title: string;
	trigger: (props: {
		className: string;
		isOpen: boolean;
		onFocus: () => void;
		openPanel: () => void;
		panelId: string;
	}) => ReactNode;
	unit?: string;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
	const anchorRef = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const panelId = useId();
	// What to focus in the details once they are placed: set by arrow down or Tab.
	const focusPanelRef = useRef<(() => void) | null>(null);
	// Returning focus to the tag on Esc must not reopen its details.
	const suppressFocusOpenRef = useRef(false);
	const { areCitationsHighlighted } = useMarkdocInteraction();
	const { fields } = useFieldState();

	// The tag's own control, not one of the tags nested in a selected case.
	const ownControl = () => {
		const field = anchorRef.current?.firstElementChild;
		return field?.matches(tagFocusSelector)
			? (field as HTMLElement)
			: field?.querySelector<HTMLElement>(`:scope > ${tagFocusSelector}`);
	};
	const close = () => {
		suppressFocusOpenRef.current = true;
		ownControl()?.focus({ preventScroll: true });
		suppressFocusOpenRef.current = false;
		setIsOpen(false);
	};
	// Closing removes the panel without a blur event; blur its focused field
	// first so a pending edit, such as a calc override, still commits.
	const dismiss = () => {
		const active = document.activeElement;
		if (active instanceof HTMLElement && panelRef.current?.contains(active)) {
			active.blur();
		}
		setIsOpen(false);
	};
	const panelControls = () =>
		[...(panelRef.current?.querySelectorAll<HTMLElement>(panelFocusSelector) ?? [])].filter(
			(element) => element.getClientRects().length > 0,
		);
	const focusPanel = () => {
		(
			panelRef.current?.querySelector<HTMLElement>("[aria-pressed=true]") ?? panelControls()[0]
		)?.focus({ preventScroll: true });
	};
	// Without a source field to type in, focus stays on the tag.
	const focusFirstInput = () =>
		panelControls()
			.find((control) => control instanceof HTMLInputElement)
			?.focus({ preventScroll: true });
	// Where opened details take focus. A condition has no value of its own and is
	// edited through its source fields; a choice starts on its chosen or first
	// option. Calculations and information are typed inline, and phones move
	// with the keyboard bar instead.
	const panelEntries: Partial<Record<TagKind, () => void>> = {
		condition: focusFirstInput,
		select: focusPanel,
	};
	const enterPanel = isPhoneLayout() ? undefined : panelEntries[kind];
	const moveToTag = (step: 1 | -1) => {
		const own = ownControl();
		setIsOpen(false);
		if (!own || !focusAdjacentTag(own, step)) {
			own?.focus();
		}
	};
	const openPanel = () => {
		// Dismiss an earlier text keyboard before opening a control without typing.
		const active = document.activeElement;
		if (
			kind !== "info" &&
			active instanceof HTMLElement &&
			!anchorRef.current?.contains(active) &&
			(active.matches("input, textarea") || active.isContentEditable)
		) {
			active.blur();
		}
		// A click on a focused tag also moves into its details.
		if (enterPanel) {
			if (panelRef.current) {
				enterPanel();
			} else {
				focusPanelRef.current = enterPanel;
			}
		}
		setIsOpen(true);
	};
	const handleFocus = () => {
		if (!openOnFocus || suppressFocusOpenRef.current) {
			return;
		}
		// Opening by Tab or click moves into the details; focus returning from
		// open details (arrow up) stays on the tag.
		if (enterPanel && !panelRef.current) {
			focusPanelRef.current = enterPanel;
		}
		setIsOpen(true);
	};

	useEffect(() => {
		const anchor = anchorRef.current;
		const toggle = () => (panelRef.current ? dismiss() : setIsOpen(true));
		const closeDetails = () => dismiss();
		anchor?.addEventListener(toggleDetailsEvent, toggle);
		anchor?.addEventListener(closeDetailsEvent, closeDetails);
		return () => {
			anchor?.removeEventListener(toggleDetailsEvent, toggle);
			anchor?.removeEventListener(closeDetailsEvent, closeDetails);
		};
	}, []);

	useLayoutEffect(() => {
		if (!isOpen) {
			return;
		}
		const viewport = window.visualViewport;
		// Measure the visible field, not the smaller inline wrapper.
		const field = anchorRef.current?.firstElementChild;
		const place = () => {
			const rect = field?.getBoundingClientRect();
			const panel = panelRef.current;
			const popup = panel?.getBoundingClientRect();
			if (!rect || !panel || !popup) {
				return;
			}
			const top = viewport?.offsetTop ?? 0;
			const left = viewport?.offsetLeft ?? 0;
			const width = viewport?.width ?? window.innerWidth;
			// Keep clear of the keyboard bar on touch devices.
			const bar = document.querySelector("[data-inline-keyboard-bar]")?.getBoundingClientRect();
			const bottom = Math.min(top + (viewport?.height ?? window.innerHeight), bar?.top ?? Infinity);
			const above = Math.max(0, rect.top - top - 20);
			const below = Math.max(0, bottom - rect.bottom - 20);
			// Natural content height, so a constrained panel cannot flip back and forth.
			const height = panel.scrollHeight + popup.height - panel.clientHeight;
			// Above when it fits, so the details do not cover the text that follows,
			// where the next tags are; otherwise wherever there is more room.
			const showBelow = height > above && (height <= below || below >= above);
			const maxHeight = showBelow ? below : above;
			const fits = kind !== "info" || height <= maxHeight;
			setPosition({
				left: Math.max(left + 12, Math.min(rect.left, left + width - popup.width - 12)),
				maxHeight: kind === "info" ? "none" : maxHeight,
				maxWidth: Math.max(0, width - 24),
				top: showBelow ? rect.bottom + 8 : rect.top - 8 - Math.min(height, maxHeight),
				// Never crop an info description or unit; hide it until it fits instead.
				visibility:
					maxHeight >= 48 && fits && rect.bottom > top && rect.top < bottom ? "visible" : "hidden",
			});
		};
		place();
		// The panel becomes visible during placement, before it can take focus.
		const focusFrame = requestAnimationFrame(() => {
			const pending = focusPanelRef.current;
			focusPanelRef.current = null;
			pending?.();
		});
		const observer = new ResizeObserver(place);
		if (panelRef.current) {
			observer.observe(panelRef.current);
		}
		if (field) {
			observer.observe(field);
		}
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		viewport?.addEventListener("resize", place);
		viewport?.addEventListener("scroll", place);
		return () => {
			cancelAnimationFrame(focusFrame);
			observer.disconnect();
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
			viewport?.removeEventListener("resize", place);
			viewport?.removeEventListener("scroll", place);
		};
	}, [isOpen, kind]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const closeOutside = (event: PointerEvent) => {
			const target = event.target as Node;
			const bar = document.querySelector("[data-inline-keyboard-bar]");
			if (
				!anchorRef.current?.contains(target) &&
				!panelRef.current?.contains(target) &&
				!bar?.contains(target)
			) {
				dismiss();
			}
		};
		document.addEventListener("pointerdown", closeOutside);
		return () => document.removeEventListener("pointerdown", closeOutside);
	}, [isOpen]);

	return (
		// Events from the field and its portaled panel stop here, so an enclosing
		// selectable tag neither swallows typed spaces nor moves focus elsewhere.
		// oxlint-disable-next-line jsx-a11y/no-static-element-interactions
		<span
			className="inline"
			data-active={isActive ? "true" : undefined}
			data-markdoc-input={name || undefined}
			data-tag-title={title}
			onBlur={(event) => {
				const next = event.relatedTarget as Node | null;
				// A mobile tap can blur a button without focusing its destination; keep
				// the dialog until the option click or the outside-pointer handler runs.
				if (!next && (interactive || isCoarsePointer())) {
					return;
				}
				if (!anchorRef.current?.contains(next) && !panelRef.current?.contains(next)) {
					setIsOpen(false);
				}
			}}
			onClickCapture={(event) => {
				// Cmd/Ctrl-click opens the value's sources, as in the side inputs.
				if ((event.metaKey || event.ctrlKey) && citations?.length && fields) {
					event.preventDefault();
					event.stopPropagation();
					fields.showSources(citations);
				}
			}}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				event.stopPropagation();
				const inPanel = Boolean(panelRef.current?.contains(event.target as Node));
				if (event.key === "Escape" && isOpen) {
					event.preventDefault();
					close();
				} else if (event.key === "Tab" && inPanel) {
					// Inside the details the arrow keys move; Tab always moves on to another tag.
					event.preventDefault();
					moveToTag(event.shiftKey ? -1 : 1);
				} else if (event.key === "ArrowDown" && !inPanel && interactive) {
					// Arrow down enters the details; Esc returns to the tag.
					event.preventDefault();
					if (isOpen) {
						focusPanel();
					} else {
						focusPanelRef.current = focusPanel;
						openPanel();
					}
				} else if (
					(event.key === "ArrowDown" || event.key === "ArrowUp") &&
					inPanel &&
					!(event.target as Element).closest("[role=grid]")
				) {
					const items = panelControls();
					const next =
						items[
							items.indexOf(event.target as HTMLElement) + (event.key === "ArrowDown" ? 1 : -1)
						];
					if (next) {
						event.preventDefault();
						next.focus();
					} else if (event.key === "ArrowUp") {
						// Above the first control, arrow up returns to the tag itself.
						event.preventDefault();
						ownControl()?.focus();
					}
				}
			}}
			ref={anchorRef}
		>
			{trigger({
				className: cn(
					fieldClassName(kind, isOpen, isActive),
					areCitationsHighlighted &&
						citations?.length &&
						"cursor-pointer border-solarized-blue/60 bg-solarized-blue/20",
				),
				isOpen,
				onFocus: handleFocus,
				openPanel,
				panelId,
			})}
			{isOpen &&
				createPortal(
					<div
						aria-label={title}
						className={cn(
							"fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] touch-manipulation overflow-y-auto rounded-md border bg-popover text-popover-foreground text-sm shadow-md outline-none",
							kind === "info" ? "p-2.5" : "p-3",
							// A plain information tooltip must not catch taps meant for the next tag.
							!interactive && "pointer-events-none",
							(kind === "calc" || kind === "condition") && "w-[min(24rem,calc(100vw-1.5rem))]",
						)}
						id={panelId}
						// Fields reached by keyboard or tap select their text, so typing replaces it.
						onFocus={(event) => {
							if (event.target instanceof HTMLInputElement) {
								event.target.select();
							}
						}}
						// Safari moves the caret to the tap on mouseup, undoing that selection.
						onPointerDown={(event) => {
							const { target } = event;
							if (target instanceof HTMLInputElement && target !== document.activeElement) {
								target.addEventListener("mouseup", (up) => up.preventDefault(), { once: true });
							}
						}}
						ref={panelRef}
						data-inline-panel
						role={interactive ? "dialog" : "tooltip"}
						style={position}
					>
						<div className="flex items-center justify-between gap-2 font-semibold text-foreground">
							<span className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
								{icon}
								{title}
							</span>
							{unit ? (
								<small className="ml-auto shrink-0 font-medium text-muted-foreground text-xs">
									{unit}
								</small>
							) : null}
							{kind === "info" ? null : (
								<button
									aria-label={`${title} schließen`}
									className="-m-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
									onClick={close}
									// Esc closes; Tab cycles through the controls that matter.
									tabIndex={-1}
									type="button"
								>
									<X aria-hidden className="h-4 w-4" />
								</button>
							)}
						</div>
						{children(close, () => moveToTag(1))}
					</div>,
					document.body,
				)}
		</span>
	);
};
