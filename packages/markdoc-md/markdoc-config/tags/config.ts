import { Tag } from '@markdoc/markdoc';
import type { Config, Node } from '@markdoc/markdoc';
import { Case } from "./case";
import { Info } from "./info";
import { Score } from "./score";
import { Switch } from "./switch";

export default {
	// cases should not contain breaks, as this will not be rendered correctly
	case: {
		attributes: { primary: { render: true, type: String } },
		children: ["text", "strong", "em", "code", "link", "inline"],
		render: "Case",
	},
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
		attributes: { primary: { required: true, type: String } },
		children: ["tag", "text"],
		render: "Switch",
		selfClosing: false,
		// this transform is necessary to only allow case tags inside switch tags to render
		// switch tags should not contain breaks, as this will not be rendered correctly (markdoc only recognizes inline tags or full paragraphs)
		transform(node: Node, config: Config) {
			const getAllCaseTags = (nodes: Node[]): Node[] => {
				const allCaseTags: Node[] = [];

				for (const childNode of nodes) {
					if (childNode.type === "tag" && childNode.tag === "case") {
						allCaseTags.push(childNode);
					}
					if (childNode.children) {
						allCaseTags.push(...getAllCaseTags(childNode.children));
					}
				}

				return allCaseTags;
			};
			node.children = getAllCaseTags(node.children);
			const attributes = node.transformAttributes(config);
			const children = node.transformChildren(config);

			return new Tag("Switch", attributes, children);
		},
	},
};

export const components: Record<string, React.ComponentType<unknown>> = {
	Case,
	Info,
	Score,
	Switch,
};
