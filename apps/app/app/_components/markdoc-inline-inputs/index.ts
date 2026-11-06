"use client";

import type { MarkdocComponentMap } from "markdoc-md/react";

import { InlineCalc } from "./calc-tag";
import { InlineCondition } from "./condition-tag";
import { InlineInfo } from "./info-tag";
import { InlineSwitch } from "./switch-tag";

/** Stable, partial map: every other tag keeps markdoc-md's default renderer. */
export const inlineInputComponents: MarkdocComponentMap = {
	Calc: InlineCalc,
	Condition: InlineCondition,
	Info: InlineInfo,
	Score: InlineCalc,
	Switch: InlineSwitch,
};

export { copyInlineSelection } from "./copy-selection";
export { InlineEditingScope, InlineFieldsProvider } from "./field-state";
export type { InlineFields } from "./field-state";
export { InlineKeyboardBar } from "./keyboard-bar";
