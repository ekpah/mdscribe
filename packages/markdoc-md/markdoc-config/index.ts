/** @type {import('@markdoc/markdoc').Config} */

import { includes, upper } from './functions';
import nodes from './nodes';
import tags from './tags/config';
import variables from './variables';

export default {
  includes,
  nodes,
  tags,
  upper,
  variables,
  // add other stuff here
};
