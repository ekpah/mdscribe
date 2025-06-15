import Markdoc, { type RenderableTreeNode } from '@markdoc/markdoc';
import React from 'react';
import config from '../markdoc-config';
import { components } from '../markdoc-config/tags/config'; // Adjusted path

/**
 * Parses a Markdoc string into an Abstract Syntax Tree (AST).
 * Applies transformations based on the provided config.
 * @param markdocString The raw Markdoc content.
 * @returns The transformed renderable tree node.
 */
export function parseMarkdoc(markdocString: string): RenderableTreeNode {
  const ast = Markdoc.parse(markdocString);
  // Apply transformations using your Markdoc config
  // This is where tags and nodes get processed initially
  const content = Markdoc.transform(ast, config);
  return content;
}

/**
 * Renders a Markdoc AST (RenderableTreeNode) into React elements.
 * This step uses the components defined in your Markdoc config.
 * @param content The renderable tree node obtained from parseMarkdoc.
 * @returns A ReactNode representing the Markdoc content.
 */
export function renderMarkdocNode(
  content: RenderableTreeNode
): React.ReactNode {
  return Markdoc.renderers.react(content, React, {
    components: components as Record<string, React.ComponentType<any>>,
  });
}

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
