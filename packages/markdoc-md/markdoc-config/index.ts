import type { Config } from "@markdoc/markdoc";

import nodes from "./nodes";
import tags from "./tags/helpers/config";

export const markdocConfig: Config = { nodes, tags };
