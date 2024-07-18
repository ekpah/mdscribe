"use client";

import { components } from "@/markdoc/tags";

import Markdoc from "@markdoc/markdoc";
import { atom, useAtom } from "jotai";
import React, { createContext, useContext, useState } from "react";
import { formAtom } from "./ContentSection";

export default function Note({ note }) {
  const content = JSON.parse(note);

  return (
    <div className="h-full w-full overflow-y-auto p-4 prose prose-slate">
      {Markdoc.renderers.react(content, React, {
        components,
      })}
    </div>
  );
}
