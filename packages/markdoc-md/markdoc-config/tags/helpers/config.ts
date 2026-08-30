import type { Config, Node, SchemaAttribute } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { isValidFormula } from "../../../parse/formula";

const roundAttribute: SchemaAttribute = {
	type: [Number, Boolean],
	validate(value) {
		if (
			value === false ||
			(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100)
		) {
			return [];
		}
		return [
			{
				id: "round-value-invalid",
				level: "error",
				message: "The 'round' attribute must be false or an integer from 0 to 100.",
			},
		];
	},
};

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
		round: roundAttribute,
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
			// Marks the fallback case of a number switch. Matches when no
			// previous condition matched, including an unset value.
			default: { required: false, type: Boolean },
			// Structured numeric conditions for number switches. Multiple
			// operators on one case combine conjunctively (gte=4 lt=10).
			eq: { required: false, type: Number },
			gt: { required: false, type: Number },
			gte: { required: false, type: Number },
			// Internal: position within the parent switch, injected by the
			// switch transform so first-match-wins selection is stable.
			index: { required: false, type: Number },
			lt: { required: false, type: Number },
			lte: { required: false, type: Number },
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
			round: roundAttribute,
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
			description: { required: false, type: String },
			primary: { required: true, type: String },
			source: { required: false, type: String },
			type: {
				matches: ["string", "boolean", "checkbox", "number"],
				required: false,
				type: String,
			},
			unit: { required: false, type: String },
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
			// Inject each case's position so first-match-wins selection is
			// stable for number switches. Scalar attributes stay serializable
			// through both the React and HTML renderers.
			for (const [index, caseNode] of node.children.entries()) {
				caseNode.attributes.index = index;
			}
			const attributes = node.transformAttributes(config);
			const children = node.transformChildren(config);

			return new Markdoc.Tag("Switch", attributes, children);
		},
	},
};

export default tags;
