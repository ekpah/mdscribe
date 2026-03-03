import { Tag } from '@markdoc/markdoc';
import type { Config, Node } from '@markdoc/markdoc';
import { Case } from "./Case";
import { Info } from "./Info";
import { Score } from "./Score";
import { Switch } from "./Switch";

export default {
	info: {
		attributes: {
			description: {
				required: false,
				type: String,
			},
			primary: {
				required: true,
				type: String,
			},
			renderUnit: {
				default: false,
				type: Boolean,
			},
			type: {
				default: "string",
				matches: ["string", "number", "date", "boolean"],
				type: String,
			},
			unit: {
				required: false,
				type: String,
			},
		},
		render: "Info",
		selfClosing: true,
	},
	score: {
		attributes: {
			formula: { required: true, type: String },
			primary: { required: true, type: String },
			renderUnit: {
				default: false,
				type: Boolean,
			},
			unit: { type: String },
		},
		render: "Score",
	},
	switch: {
		render: "Switch",
		children: ["tag", "text"],
		attributes: { primary: { required: true, type: String } },
		selfClosing: false,
		// this transform is necessary to only allow case tags inside switch tags to render
		// switch tags should not contain breaks, as this will not be rendered correctly (markdoc only recognizes inline tags or full paragraphs)
		transform(node: Node, config: Config) {
			const getAllCaseTags = (nodes: Node[]): Node[] => nodes.reduce((acc: Node[], node) => {
					if (node.type === "tag" && node.tag === "case") {
						acc.push(node);
					}
					if (node.children) {
						acc.push(...getAllCaseTags(node.children));
					}
					return acc;
				}, []);
			node.children = getAllCaseTags(node.children);
			const attributes = node.transformAttributes(config);
			const children = node.transformChildren(config);

			return new Tag("Switch", attributes, children);
		},
	},
	// cases should not contain breaks, as this will not be rendered correctly
	case: {
		attributes: { primary: { render: true, type: String } },
		children: ["text", "strong", "em", "code", "link", "inline"],
		render: "Case",
	},
};

export const components: Record<string, React.ComponentType<any>> = {
	Case,
	Info,
	Score,
	Switch,
};
