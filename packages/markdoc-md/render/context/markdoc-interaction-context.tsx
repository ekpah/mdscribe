"use client";

import { createContext, useContext } from "react";
import type { CitationRequest } from "../../citations/resolvers/types";

export interface MarkdocInteractionContextType {
	activeTagName?: string | null;
	areCitationsHighlighted: boolean;
	onCitationSelect?: (citation: CitationRequest) => void;
	onTagSelect?: (tagName: string) => void;
}

const MarkdocInteractionContext = createContext<MarkdocInteractionContextType>({
	areCitationsHighlighted: false,
});

export const MarkdocInteractionProvider = MarkdocInteractionContext.Provider;

export const useMarkdocInteraction = (): MarkdocInteractionContextType =>
	useContext(MarkdocInteractionContext);
