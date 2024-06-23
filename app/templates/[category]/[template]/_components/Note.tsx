"use client";

import Markdoc from "@markdoc/markdoc";
import React from "react";

import { components } from "@/markdoc/tags";

export default function Note({ note }) {
  const content = JSON.parse(note);
  return (
    <div className="h-full w-1/2 overflow-y-auto border-l p-4 prose prose-slate">
      {Markdoc.renderers.react(content, React, { components })}
    </div>
  );
}
