import type { Config } from "@markdoc/markdoc";

import nodes from "./nodes";
import tags from "./tags/config";

export const markdocConfig: Config = { nodes, tags };
