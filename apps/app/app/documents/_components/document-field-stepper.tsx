"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CitationRequest } from "markdoc-md/citations";
import type { InputTagType } from "markdoc-md/parse";
import { I18nProvider } from "react-aria-components";

import { InputsList } from "@/app/_components/inputs/inputs";
import type { TemplateFields } from "@/app/_components/inputs/inputs";

const fieldControlSelector =
	"input:not([type=hidden]):not([hidden]):not([tabindex='-1']):not([disabled]), textarea, select, button:not([disabled]), [tabindex='0']";

/**
 * One document field at a time, under the PDF that highlights it: the side
 * form's control for that field, with previous/next. Enter also moves on.
 */
export const DocumentFieldStepper = ({
	activeInputName,
	focusKey,
	form,
	inputs,
	onActiveChange,
	onCitationsSelect,
	onInputBlur,
}: {
	activeInputName: string | null;
	/** Changes whenever the shown field should take focus. */
	focusKey?: number;
	form: TemplateFields;
	inputs: InputTagType[];
	/** Shows another field and highlights it on the PDF. */
	onActiveChange: (inputName: string, focus: boolean) => void;
	onCitationsSelect: (citations: CitationRequest[]) => void;
	onInputBlur: () => void;
}) => {
	if (inputs.length === 0) {
		return null;
	}
	const index = Math.max(
		0,
		inputs.findIndex((input) => input.attributes.primary === activeInputName),
	);
	const input = inputs[index];
	const step = (offset: 1 | -1) => {
		const next = inputs[(index + offset + inputs.length) % inputs.length];
		if (next) {
			// The shown field unmounts without a blur event; refresh the PDF for it.
			onInputBlur();
			onActiveChange(next.attributes.primary, true);
		}
	};

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Enter steps on from the field inside.
		<fieldset
			aria-label="Dokumentfelder"
			data-field-editor
			className="m-0 flex min-w-0 shrink-0 items-end gap-2 border-t bg-muted/40 px-3 py-2"
			onKeyDown={(event) => {
				const target = event.target as HTMLElement;
				// Tab past the shown field's first or last control moves to the adjacent field.
				if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
					const controls = [
						...(event.currentTarget
							.querySelector("[data-field-controls]")
							?.querySelectorAll<HTMLElement>(fieldControlSelector) ?? []),
					].filter(
						// Option groups move focus with arrow keys; only their focused option is a stop.
						(control) =>
							control.getClientRects().length > 0 && (control === target || control.tabIndex >= 0),
					);
					// Typing controls are the stops; helper buttons such as the calendar are not.
					const typing = controls.filter((control) => control.tagName !== "BUTTON");
					const stops = typing.length > 0 ? typing : controls;
					const edge = event.shiftKey ? stops[0] : stops.at(-1);
					if (edge && (edge === target || edge.contains(target))) {
						event.preventDefault();
						step(event.shiftKey ? -1 : 1);
					}
					return;
				}
				if (
					event.key === "Enter" &&
					target.matches("input[type=text], input:not([type]), [role=spinbutton]")
				) {
					event.preventDefault();
					step(event.shiftKey ? -1 : 1);
				}
			}}
		>
			<Button
				aria-label="Vorheriges Feld"
				onClick={() => step(-1)}
				size="icon"
				type="button"
				variant="outline"
			>
				<ChevronLeft aria-hidden className="h-4 w-4" />
			</Button>
			{input ? (
				<div className="min-w-0 flex-1" data-field-controls>
					<I18nProvider locale="de-DE">
						<InputsList
							activeInputFocusKey={focusKey}
							activeInputName={activeInputName}
							className="pointer-coarse:[&_input]:text-base"
							fields={form}
							inputTags={[input]}
							onCitationsSelect={onCitationsSelect}
							onInputBlur={onInputBlur}
							onInputSelect={(name) => onActiveChange(name, false)}
						/>
					</I18nProvider>
				</div>
			) : null}
			<span className="shrink-0 pb-2.5 text-muted-foreground text-xs tabular-nums">
				{index + 1}/{inputs.length}
			</span>
			<Button
				aria-label="Nächstes Feld"
				onClick={() => step(1)}
				size="icon"
				type="button"
				variant="outline"
			>
				<ChevronRight aria-hidden className="h-4 w-4" />
			</Button>
		</fieldset>
	);
};
