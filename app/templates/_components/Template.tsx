"use client";

import Gender from "@/components/inputs/Gender";
import Name from "@/components/inputs/Name";

import Note from "./Note";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full justify-items-stretch">
      <div className="h-full w-1/2 overflow-y-auto p-4 prose prose-slate">
        <Gender />
        <br />
        <Name />
        <br />
      </div>
      <Note>{children}</Note>
    </div>
  );
}
