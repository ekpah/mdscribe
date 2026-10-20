import Markdoc from "@markdoc/markdoc";

import { Calc } from "../calc";
import { Case } from "../case";
import { Cite } from "../cite";
import { Details } from "../details";
import { Info } from "../info";
import { Condition, Switch } from "../switch";

/** Default React components used by the built-in Markdoc tag schema. */
export type MarkdocComponentMap = Exclude<
	NonNullable<Parameters<typeof Markdoc.renderers.react>[2]>["components"],
	undefined | ((name: string) => object)
>;

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
