import { Tag } from "@markdoc/markdoc";
import type { Config, Node } from "@markdoc/markdoc";
import { markdocConfig } from "markdoc-md/config";
import { validateMarkdocTemplate } from "markdoc-md/parse";
import type { MarkdocTemplateDiagnostic } from "markdoc-md/parse";

import { validateTemplateSections } from "./sections";

/**
 * Tags only this app uses so far, added to the markdoc-md config the way a host
 * extends it: `ai` instructions and `section` parts of a letter.
 */
export const templateTags: NonNullable<Config["tags"]> = {
	// An instruction for the AI, inline or around whole paragraphs; never part of the text.
	ai: {
		children: [
			"blockquote",
			"em",
			"heading",
			"inline",
			"item",
			"list",
			"paragraph",
			"softbreak",
			"hardbreak",
			"strong",
			"tag",
			"text",
		],
		render: "Ai",
		selfClosing: false,
		transform(node: Node, config: Config) {
			return new Tag("Ai", node.inline ? {} : { block: true }, node.transformChildren(config));
		},
	},
	// One titled part of a letter. Placement and unique ids are checked by
	// validateTemplateSections, because they depend on the whole template.
	section: {
		attributes: {
			// Stable key of the section, e.g. in generated output; letters, digits, - and _.
			id: {
				required: true,
				type: String,
				validate(value) {
					return typeof value !== "string" || /^[\w-]+$/u.test(value)
						? []
						: [
								{
									id: "section-id-invalid",
									level: "error",
									message:
										"The section 'id' may only contain letters, digits, hyphens and underscores.",
								},
							];
				},
			},
			// Label shown above the section; falls back to the id.
			title: { required: false, type: String },
		},
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
		render: "Section",
		selfClosing: false,
	},
};

/** The markdoc-md config with this app's tags; pass it wherever templates are parsed or rendered. */
export const appMarkdocConfig: Config = {
	...markdocConfig,
	tags: { ...markdocConfig.tags, ...templateTags },
};

/** Complete template validation, including the app's tags and section placement. */
export const validateAppTemplate = (content: string): MarkdocTemplateDiagnostic[] => [
	...validateMarkdocTemplate(content, appMarkdocConfig),
	...validateTemplateSections(content),
];
