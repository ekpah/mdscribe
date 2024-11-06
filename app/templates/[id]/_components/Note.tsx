"use client";

import { components } from "@/markdoc/tags";

import { Separator } from "@/components/ui/separator";
import Markdoc from "@markdoc/markdoc";

import React from "react";
import { NavActions } from "./NavActions";

export default function Note({ note }) {
  const content = JSON.parse(note);

  return (
    <div className="grow">
      <div className="overflow-y-auto prose prose-slate">
        {Markdoc.renderers.react(content, React, {
          components,
        })}
      </div>
    </div>
  );
}
