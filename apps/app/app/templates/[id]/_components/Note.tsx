'use client';

import { components } from '@/markdoc/tags';

import Markdoc from '@markdoc/markdoc';

import React from 'react';

export default function Note({ note }: { note: string }) {
  const content = JSON.parse(note);

  return (
    <div className="prose prose-slate grow">
      {Markdoc.renderers.react(content, React, {
        components,
      })}
    </div>
  );
}
