import type { AnyExtension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { markdocConfig } from "markdoc-md/config";
import { htmlToMarkdoc, renderTipTapHTML } from "markdoc-md/editor";
import type { HtmlToMarkdocRenderer } from "markdoc-md/editor";
import { validateMarkdocTemplate } from "markdoc-md/parse";
import type { MarkdocTemplateDiagnostic } from "markdoc-md/parse";
import type { ComponentType } from "react";

/**
 * Tags a host adds to the editor: their Markdoc schemas, the Tiptap nodes or
 * marks that edit them, and how their editor elements are written back.
 */
export interface MarkdocEditorPlugin {
	/** Markdoc schemas, merged into the package config for rendering and validation. */
	tags: NonNullable<(typeof markdocConfig)["tags"]>;
	/** Tiptap nodes and marks that edit the tags. */
	extensions: AnyExtension[];
	/** Writes each editor element back to Markdoc, keyed by lowercase element name. */
	renderers: Partial<Record<string, HtmlToMarkdocRenderer>>;
	/** Checks of the whole template beyond the tag schemas. */
	validate?: (content: string) => MarkdocTemplateDiagnostic[];
	/** Toolbar buttons, shown after the built-in tag buttons. */
	Toolbar?: ComponentType<{ editor: Editor; tagButtonClassName: string }>;
	/** Shown below the text, e.g. a button that appends a block. */
	Footer?: ComponentType<{ editor: Editor }>;
	/** Help shown in the tag inspector. */
	Help?: ComponentType;
}

const plugins: MarkdocEditorPlugin[] = [];

/** Adds a plugin to every editor; registering the same plugin again changes nothing. */
export const registerMarkdocEditorPlugin = (plugin: MarkdocEditorPlugin): void => {
	if (!plugins.includes(plugin)) {
		plugins.push(plugin);
	}
};

export const getMarkdocEditorPlugins = (): readonly MarkdocEditorPlugin[] => plugins;

const getEditorConfig = (): typeof markdocConfig => ({
	...markdocConfig,
	tags: Object.assign({}, markdocConfig.tags, ...plugins.map((plugin) => plugin.tags)),
});

/** Editor HTML of a template, including plugin tags. */
export const toEditorHTML = (markdoc: string): string =>
	renderTipTapHTML(markdoc, { config: getEditorConfig() });

/** Markdoc of editor HTML, including plugin tags. */
export const toMarkdoc = (html: string): string =>
	htmlToMarkdoc(html, {
		renderers: Object.assign({}, ...plugins.map((plugin) => plugin.renderers)),
	});

/** Template validation with the plugin tags and checks. */
export const validateEditorTemplate = (content: string): MarkdocTemplateDiagnostic[] => [
	...validateMarkdocTemplate(content, getEditorConfig()),
	...plugins.flatMap((plugin) => plugin.validate?.(content) ?? []),
];

/** Markdoc names of the plugin tags. */
export const getPluginTagNames = (): string[] =>
	plugins.flatMap((plugin) => Object.keys(plugin.tags));

/** Render names of plugin tags, i.e. their editor element names. */
export const getPluginRenderNames = (): string[] =>
	plugins.flatMap((plugin) =>
		Object.values(plugin.tags).flatMap((schema) =>
			typeof schema.render === "string" ? [schema.render] : [],
		),
	);
