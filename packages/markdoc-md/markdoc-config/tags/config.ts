import { Tag } from "@markdoc/markdoc";
import type { Config, Node } from "@markdoc/markdoc";
import type { ComponentType } from "react";

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
				matches: ["string", "number", "date"],
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
		attributes: {
			primary: { required: true, type: String },
			type: {
				required: false,
				matches: ["string", "boolean", "checkbox"],
				type: String,
			},
		},
		children: ["tag", "text"],
		render: "Switch",
		selfClosing: false,
		// this transform is necessary to only allow case tags inside switch tags to render
		// switch tags should not contain breaks, as this will not be rendered correctly (markdoc only recognizes inline tags or full paragraphs)
		transform(node: Node, config: Config) {
			const collectCaseTagsFromWrapper = (candidate: Node): Node[] => {
				if (candidate.type === "tag") {
					return candidate.tag === "case" ? [candidate] : [];
				}

				// Markdoc can wrap tags inside paragraph/inline helper nodes.
				// We unwrap those wrappers but intentionally do not traverse into
				// non-case tags to preserve nested switch scoping.
				if (
					(candidate.type === "document" ||
						candidate.type === "inline" ||
						candidate.type === "paragraph") &&
					candidate.children
				) {
					const collectedCases: Node[] = [];
					for (const child of candidate.children) {
						collectedCases.push(...collectCaseTagsFromWrapper(child));
					}
					return collectedCases;
				}

				return [];
			};

			const getImmediateCaseTags = (nodes: Node[]): Node[] => {
				const immediateCaseTags: Node[] = [];

				for (const childNode of nodes) {
					immediateCaseTags.push(...collectCaseTagsFromWrapper(childNode));
				}

				return immediateCaseTags;
			};
			node.children = getImmediateCaseTags(node.children);
			const attributes = node.transformAttributes(config);
			const children = node.transformChildren(config);

			return new Tag("Switch", attributes, children);
		},
	},
};

export const components: Record<string, ComponentType<unknown>> = {
	Case: Case as ComponentType<unknown>,
	Info: Info as ComponentType<unknown>,
	Score: Score as ComponentType<unknown>,
	Switch: Switch as ComponentType<unknown>,
};
