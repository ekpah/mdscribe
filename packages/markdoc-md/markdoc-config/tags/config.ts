import type { Config, Node } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { isValidFormula } from "../../parse/formula";

const calcTag: NonNullable<Config["tags"]>[string] = {
	attributes: {
		formula: {
			required: true,
			type: String,
			validate(value) {
				if (typeof value !== "string" || isValidFormula(value)) {
					return [];
				}
				return [
					{
						id: "calc-formula-invalid",
						level: "error",
						message: "The 'formula' attribute must be a valid calc formula.",
					},
				];
			},
		},
		primary: { required: false, type: String },
		renderUnit: {
			default: false,
			type: Boolean,
		},
		unit: { type: String },
	},
	children: ["tag", "text"],
	render: "Calc",
};

const tags: NonNullable<Config["tags"]> = {
	calc: calcTag,
	// cases should not contain breaks, as this will not be rendered correctly
	case: {
		attributes: {
			primary: { render: true, type: String },
			value: { required: false, type: Number },
		},
		children: ["text", "strong", "em", "code", "link", "inline"],
		render: "Case",
	},
	cite: {
		attributes: {
			quote: { required: false, type: String },
			source: { required: true, type: String },
		},
		children: ["text", "strong", "em", "code", "inline"],
		render: "Cite",
		selfClosing: false,
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
			source: {
				required: false,
				type: String,
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
	// Legacy alias. Both syntaxes transform to the canonical Calc component.
	score: calcTag,
	switch: {
		attributes: {
			primary: { required: true, type: String },
			source: { required: false, type: String },
			type: {
				matches: ["string", "boolean", "checkbox"],
				required: false,
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

			return new Markdoc.Tag("Switch", attributes, children);
		},
	},
};

export default tags;
