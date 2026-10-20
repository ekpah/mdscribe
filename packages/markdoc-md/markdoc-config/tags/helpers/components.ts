import type { ComponentType } from "react";

import { Calc } from "../calc";
import type { CalcProps } from "../calc";
import { Case } from "../case";
import type { CaseProps } from "../case";
import { Cite } from "../cite";
import type { CiteProps } from "../cite";
import { Details } from "../details";
import type { DetailsProps } from "../details";
import { Info } from "../info";
import type { InfoProps } from "../info";
import { Condition, Switch } from "../switch";
import type { SwitchProps } from "../switch";

/**
 * React components keyed by Markdoc render name. Built-in tags must accept
 * their documented props; custom render names accept any component.
 */
export interface MarkdocComponentMap {
	Calc?: ComponentType<CalcProps>;
	Case?: ComponentType<CaseProps>;
	Cite?: ComponentType<CiteProps>;
	Condition?: ComponentType<SwitchProps>;
	Details?: ComponentType<DetailsProps>;
	Info?: ComponentType<InfoProps>;
	Score?: ComponentType<CalcProps>;
	Switch?: ComponentType<SwitchProps>;
	// oxlint-disable-next-line typescript/no-explicit-any -- Custom render names accept any component, as Markdoc's renderer does.
	[renderName: string]: ComponentType<any> | undefined;
}

export const components = {
	Calc,
	Case,
	Cite,
	Condition,
	Details,
	Info,
	Score: Calc,
	Switch,
} satisfies MarkdocComponentMap;
