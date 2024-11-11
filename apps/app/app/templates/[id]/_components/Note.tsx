'use client';

import { components } from '@/markdoc/tags';

import Markdoc from '@markdoc/markdoc';

import React from 'react';

export default function Note({ note }) {
  const content = JSON.parse(note);

  return (
    <div className="grow prose prose-slate">
      {Markdoc.renderers.react(content, React, {
        components,
      })}
    </div>
  );
}
