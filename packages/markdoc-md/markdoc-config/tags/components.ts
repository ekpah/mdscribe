import Markdoc from "@markdoc/markdoc";

import { Case } from "./case";
import { Cite } from "./cite";
import { Info } from "./info";
import { Score } from "./score";
import { Switch } from "./switch";

/** Default React components used by the built-in Markdoc tag schema. */
export type MarkdocComponentMap = Exclude<
	NonNullable<Parameters<typeof Markdoc.renderers.react>[2]>["components"],
	undefined | ((name: string) => object)
>;

export const components = { Case, Cite, Info, Score, Switch } satisfies MarkdocComponentMap;
