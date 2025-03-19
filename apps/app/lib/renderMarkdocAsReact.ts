import Markdoc from '@markdoc/markdoc';

import React from 'react';

import { components } from '@/markdoc/tags';

import markdocConfig from '@/markdoc/config';

// function to take markdoc content and return parsed tags
export default function renderMarkdocAsReact(content: string) {
  const ast = Markdoc.parse(content);
  const note = Markdoc.transform(ast, markdocConfig);
  return Markdoc.renderers.react(note, React, {
    components: components as Record<string, React.ComponentType<any>>,
  });
}
