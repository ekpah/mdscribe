import Markdoc from '@markdoc/markdoc';

import React from 'react';

import { components } from '../../markdoc-config/tags/config';

import markdocConfig from '../../markdoc-config';

/**
 * Renders a Markdoc string into React elements.
 * This step uses the components defined in your Markdoc config.
 * @param content The raw Markdoc content.
 * @returns A ReactNode representing the Markdoc content.
 */
export default function renderMarkdocAsReact(content: string) {
  const ast = Markdoc.parse(content);
  const note = Markdoc.transform(ast, markdocConfig);
  return Markdoc.renderers.react(note, React, {
    components: components as Record<string, React.ComponentType<any>>,
  });
}
