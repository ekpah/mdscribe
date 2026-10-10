import type { Config, Node, SchemaAttribute } from "@markdoc/markdoc";
import Markdoc from "@markdoc/markdoc";

import { isValidFormula } from "../../../parse/formula";
import { immediateCases } from "./cases";
import { readDetailsLineFlow } from "./details-line-flow";

/**
 * Label rendered for a `details` tag without a `summary`, matching the label
 * GitHub's rendering falls back to. Kept here so the React component and the
 * editor node view cannot drift apart.
 */
export const DEFAULT_DETAILS_SUMMARY = "Details";

/** Shown in place of a calculated value until all of its inputs are filled in. */
export const CALC_PLACEHOLDER = "…";

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
		description: { required: false, type: String },
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
		primary: {
			required: true,
			type: String,
			validate(value) {
				return typeof value === "string" && !value.trim()
					? [
							{
								id: "calc-primary-invalid",
								level: "error",
								message: "Calc requires a non-empty primary name.",
							},
						]
					: [];
			},
		},
		renderUnit: {
			default: false,
			type: Boolean,
		},
		round: roundAttribute,
		source: { required: false, type: String },
		unit: { type: String },
	},
	children: ["tag", "text"],
	render: "Calc",
};

/**
 * Keeps only a switch's or condition's own cases and gives each its position,
 * so first-match selection is stable in every renderer.
 */
const transformBranchingTag = (render: "Condition" | "Switch") => (node: Node, config: Config) => {
	node.children = immediateCases(node);
	for (const [index, caseNode] of node.children.entries()) {
		caseNode.attributes.index = index;
	}
	return new Markdoc.Tag(render, node.transformAttributes(config), node.transformChildren(config));
};

const tags: NonNullable<Config["tags"]> = {
	calc: calcTag,
	condition: {
		attributes: {
			description: { required: false, type: String },
			primary: { required: true, type: [String, Array] },
			source: { required: false, type: String },
			unit: { required: false, type: String },
		},
		children: ["tag", "text", "paragraph", "inline"],
		render: "Condition",
		selfClosing: false,
		transform: transformBranchingTag("Condition"),
	},
	case: {
		attributes: {
			// Marks the fallback case. Matches when no previous case matched,
			// including an unset value.
			default: { required: false, type: Boolean },
			// Numeric comparisons of condition cases. Multiple operators on one
			// case combine conjunctively (gte=4 lt=10); arrays align with an
			// array primary, with null skipping a member (gt=[11,null]).
			eq: { required: false, type: [Number, Array] },
			gt: { required: false, type: [Number, Array] },
			gte: { required: false, type: [Number, Array] },
			// Internal: position within the parent switch or condition, injected
			// by its transform so first-match selection is stable.
			index: { required: false, type: Number },
			lt: { required: false, type: [Number, Array] },
			lte: { required: false, type: [Number, Array] },
			primary: { render: true, type: String },
			value: { required: false, type: Number },
		},
		// Cases contain rich Markdown and arbitrarily nested template tags.
		render: "Case",
	},
	// GitHub-style collapsed section. Renders native <details>/<summary>.
	details: {
		attributes: {
			// Matches GitHub's `<details open>`: expands the section by default.
			open: { default: false, type: Boolean },
			// Optional label; rendering falls back to DEFAULT_DETAILS_SUMMARY.
			summary: { required: false, type: String },
		},
		// Rich block content, including nested template tags.
		children: [
			"blockquote",
			"comment",
			"fence",
			"heading",
			"hr",
			"inline",
			"item",
			"list",
			"paragraph",
			"table",
			"tag",
			"text",
		],
		inline: false,
		render: "Details",
		selfClosing: false,
		transform(node: Node, config: Config) {
			return new Markdoc.Tag(
				"Details",
				// The line flow comes from the source layout, not from an authored attribute.
				{ ...node.transformAttributes(config), ...readDetailsLineFlow(node) },
				node.transformChildren(config),
			);
		},
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
			primary: { required: true, type: [String, Array] },
			source: { required: false, type: String },
			type: {
				matches: ["string", "boolean", "checkbox"],
				required: false,
				type: String,
			},
			unit: { required: false, type: String },
		},
		children: ["tag", "text", "paragraph", "inline"],
		render: "Switch",
		selfClosing: false,
		transform: transformBranchingTag("Switch"),
	},
};

export default tags;
