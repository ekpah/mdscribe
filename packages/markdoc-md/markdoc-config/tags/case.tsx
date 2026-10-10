"use client";

import type { ReactNode } from "react";
import React from "react";

import { SwitchContext } from "./switch";

export interface CaseProps {
	primary?: string;
	value?: number;
	default?: boolean;
	/** Numeric comparisons of condition cases; arrays align with an array primary. */
	eq?: number | (number | null)[];
	gt?: number | (number | null)[];
	gte?: number | (number | null)[];
	lt?: number | (number | null)[];
	lte?: number | (number | null)[];
	/** Injected by the switch transform: position within the parent switch. */
	index?: number;
	children?: ReactNode;
}

export const Case = ({ index, children }: CaseProps) => {
	const context = React.useContext(SwitchContext);
	if (context === null || typeof index !== "number" || context.matchedIndex !== index) {
		return null;
	}
	return children;
};
