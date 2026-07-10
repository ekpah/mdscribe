"use client";

import { createContext, useContext } from "react";

interface MarkdocInteractionContextType {
	activeTagName?: string | null;
	onTagSelect?: (tagName: string) => void;
}

const MarkdocInteractionContext = createContext<MarkdocInteractionContextType>({});

export const MarkdocInteractionProvider = MarkdocInteractionContext.Provider;

export const useMarkdocInteraction = (): MarkdocInteractionContextType =>
	useContext(MarkdocInteractionContext);

