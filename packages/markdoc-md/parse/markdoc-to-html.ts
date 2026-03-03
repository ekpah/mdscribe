import Markdoc from '@markdoc/markdoc';
import config from '../markdoc-config';

/**
 * Renders a Markdoc string into HTML to be used in TipTap. This could also be used to render the content in just HTML, but is most useful for TipTap, as it allows for the use of the components defined in your Markdoc config.
 * @param markdocString The raw Markdoc content.
 * @returns A string representing the Markdoc content as HTML.
 */
export function renderTipTapHTML(markdocString: string): string {
  const ast = Markdoc.parse(markdocString);
  // Apply transformations using your Markdoc config
  // This is where tags and nodes get processed initially
  const content = Markdoc.transform(ast, config);
  return Markdoc.renderers.html(content);
}
