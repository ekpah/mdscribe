import Markdoc, { type Config, type RenderableTreeNode, type Schema } from '@markdoc/markdoc';
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
export function renderMarkdocNode(content: RenderableTreeNode): React.ReactNode {
  return Markdoc.renderers.react(content, React, {
    components: components as Record<string, React.ComponentType<any>>,
  });
}