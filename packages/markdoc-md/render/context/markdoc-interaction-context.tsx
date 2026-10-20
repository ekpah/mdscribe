"use client";

import { createContext, useContext } from "react";

import type { CitationRequest } from "../../citations/resolvers/types";
import type { VariableValue } from "./variable-context";

export interface MarkdocInteractionContextType {
	activeTagName?: string | null;
	areCitationsHighlighted: boolean;
	onCitationSelect?: (citation: CitationRequest) => void;
	onTagSelect?: (tagName: string) => void;
	/**
	 * Writes a variable from inside the rendered document, e.g. an inline input.
	 * Undefined in read-only renderers, so components can fall back to text.
	 */
	onVariableChange?: (name: string, value: VariableValue) => void;
}

const MarkdocInteractionContext = createContext<MarkdocInteractionContextType>({
	areCitationsHighlighted: false,
});

export const MarkdocInteractionProvider = MarkdocInteractionContext.Provider;

export const useMarkdocInteraction = (): MarkdocInteractionContextType =>
	useContext(MarkdocInteractionContext);
