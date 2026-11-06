"use client";

import type { CitationRequest } from "markdoc-md/citations";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

import type { FieldState } from "../inputs/inputs";

/** What the template knows about each field, and its write paths. */
export interface InlineFields {
	states: Record<string, FieldState>;
	setValue: (key: string, value: unknown) => void;
	/** Accepts the AI suggestion or resumes a calculation, like the side inputs' reset. */
	clearValue: (key: string) => void;
	showSources: (citations: CitationRequest[]) => void;
}
const InlineFieldsContext = createContext<InlineFields | null>(null);
/** The inline field being edited; the text keeps its layout until it is left. */
const EditingFieldContext = createContext<Element | null>(null);
/**
 * While a field is edited, tags show what they showed when its editing began,
 * so the line does not move with each keystroke. Leaving the field, also to
 * another one, shows the current value.
 */
export const useLayoutValue = <T,>(value: T): T => {
	const editing = useContext(EditingFieldContext);
	const [snapshot, setSnapshot] = useState({ editing, value });
	if (snapshot.editing !== editing) {
		setSnapshot({ editing, value });
		return value;
	}
	return editing ? snapshot.value : value;
};
/** Tracks the inline field being edited, in the text or in a tag's details. */
export const InlineEditingScope = ({ children }: { children: ReactNode }) => {
	const [field, setField] = useState<Element | null>(null);
	useEffect(() => {
		const update = () => {
			const active = document.activeElement;
			setField(
				active instanceof HTMLInputElement &&
					active.closest("[data-markdoc-input], [data-inline-panel]")
					? active
					: null,
			);
		};
		document.addEventListener("focusin", update);
		document.addEventListener("focusout", update);
		return () => {
			document.removeEventListener("focusin", update);
			document.removeEventListener("focusout", update);
		};
	}, []);
	return <EditingFieldContext.Provider value={field}>{children}</EditingFieldContext.Provider>;
};
export const InlineFieldsProvider = InlineFieldsContext.Provider;
export const useFieldState = (name?: string) => {
	const fields = useContext(InlineFieldsContext);
	return { fields, state: name ? fields?.states[name] : undefined };
};
