/** @type {import('@markdoc/markdoc').Config} */

import * as functions from "./functions";
import nodes from "./nodes";
import tags from "./tags";
import variables from "./variables.ts";

export default {
  ...functions,
  tags,
  nodes,
  variables,
  // add other stuff here
};
