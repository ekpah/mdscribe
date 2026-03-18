import * as Markdoc from '@markdoc/markdoc';
import React from 'react';
import config from '@repo/markdoc-md/markdoc-config';

/**
 * Renders a Markdoc string into HTML to be used in TipTap. This could also be used to render the content in just HTML, but is most useful for TipTap, as it allows for the use of the components defined in your Markdoc config.
 * @param {string} markdocString - The raw Markdoc content.
 * @returns {string} A string representing the Markdoc content as HTML.
 */
export const renderTipTapHTML = (markdocString: string): string => {
  const ast = Markdoc.parse(markdocString);
  // Apply transformations using your Markdoc config
  // This is where tags and nodes get processed initially
  const content = Markdoc.transform(ast, config);
  return Markdoc.renderers.html(content);
};
