"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { InputContextController } from "./types";
import { useInputContextState } from "./use-input-context-state";

const CaseContext = createContext<InputContextController | null>(null);

/**
 * The current case: text, audio and files entered on a template, AI Scribe or PDF form
 * page. It lives in the root layout, so it stays while the user switches between
 * templates, and ends with "Neuer Fall", sign-out or a full page load.
 */
export const CaseProvider = ({ children }: { children: ReactNode }) => {
	// A new object only when the case changes: the provider renders only for its own state.
	const controller = useInputContextState();
	return <CaseContext value={controller}>{children}</CaseContext>;
};

export const useCase = (): InputContextController => {
	const controller = useContext(CaseContext);
	if (!controller) {
		throw new Error("useCase must be used inside CaseProvider");
	}
	return controller;
};
