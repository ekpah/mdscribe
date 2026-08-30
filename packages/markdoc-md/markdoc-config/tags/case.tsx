"use client";

import type { ReactNode } from "react";
import React from "react";

import { SwitchContext } from "./switch";

export interface CaseProps {
	primary?: string;
	value?: number;
	/** Structured numeric conditions (number switches). */
	default?: boolean;
	eq?: number;
	gt?: number;
	gte?: number;
	lt?: number;
	lte?: number;
	/** Injected by the switch transform: position within the parent switch. */
	index?: number;
	children?: ReactNode;
}

export const Case = ({ primary, index, children }: CaseProps) => {
	const context = React.useContext(SwitchContext);
	if (context === null) {
		return null;
	}
	if (context.kind === "number") {
		if (typeof index !== "number" || context.matchedIndex !== index) {
			return null;
		}
		return children;
	}
	if (typeof primary !== "string" || context.value !== primary) {
		return null;
	}
	return children;
};
