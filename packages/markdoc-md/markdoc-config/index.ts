/** @type {import('@markdoc/markdoc').Config} */

import * as functions from "./functions";
import nodes from "./nodes";
import tags from "./tags/config";
import variables from "./variables";

export default {
  ...functions,
  tags,
  nodes,
  variables,
  // add other stuff here
};
