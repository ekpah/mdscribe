import type { Config, Node, Schema } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { markDetailsLineFlow } from "../tags/helpers/details-line-flow";

const document: Schema = {
	...Markdoc.nodes.document,
	transform(node: Node, config: Config) {
		// Details sections need their sibling layout, which only the whole tree has.
		markDetailsLineFlow(node);
		return new Markdoc.Tag(
			"article",
			node.transformAttributes(config),
			node.transformChildren(config),
		);
	},
};

export default { document };
