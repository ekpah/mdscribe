import Markdoc from '@markdoc/markdoc';
import type { Config } from '@markdoc/markdoc';
import { markdocConfig as config } from "../../markdoc-config";
import { sanitizeMarkdocForRendering } from './sanitize-markdoc-for-rendering';

/**
 * Renders a Markdoc string into HTML to be used in TipTap. This could also be used to render the content in just HTML, but is most useful for TipTap, as it allows for the use of the components defined in your Markdoc config.
 * @param {string} markdocString - The raw Markdoc content.
 * @returns {string} A string representing the Markdoc content as HTML.
 */
export const renderTipTapHTML = (
	markdocString: string,
	options: { config?: Config; sanitize?: boolean } = {},
): string => {
	const source =
		options.sanitize === false
			? markdocString
			: sanitizeMarkdocForRendering(markdocString);
	const ast = Markdoc.parse(source);
	const content = Markdoc.transform(ast, options.config ?? config);
	return Markdoc.renderers.html(content);
};
