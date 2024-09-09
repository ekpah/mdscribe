"use client";

import { components } from "@/markdoc/tags";

import { Separator } from "@/components/ui/separator";
import Markdoc from "@markdoc/markdoc";

import React from "react";

export default function Note({ note }) {
  const content = JSON.parse(note);

  return (
    <>
      <span className="text-xl font-bold">Generierte Notiz</span>
      <Separator />
      <div className="h-full w-full overflow-y-auto p-4 prose prose-slate">
        {Markdoc.renderers.react(content, React, {
          components,
        })}
      </div>
    </>
  );
}
