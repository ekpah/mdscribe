"use client";
import { atom, useAtom } from "jotai";
import React from "react";

import { Card } from "@/components/ui/card";

import { Prisma } from "@prisma/client";
import Inputs from "./Inputs";
import { NavActions } from "./NavActions";
import Note from "./Note";

export const formAtom = atom({});

export default function ContentSection({
  note,
  inputTags = "[]",
  template,
}: {
  note: string;
  inputTags: string;
  template: Prisma.TemplateGetPayload<{}>;
}) {
  const [formData, setFormData] = useAtom(formAtom);

  const handleFormChange = (data) => {
    setFormData(data);
  };
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex h-10 items-center gap-2 justify-between">
        <span className="font-bold">{template?.title}</span>
        <NavActions template={template} />
      </div>
      <Card className="grid grid-cols-3 gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] overflow-hidden">
        <div key="Inputs" className="p-4 overflow-y-auto overscroll-none">
          <Inputs inputTags={inputTags} onChange={handleFormChange} />
        </div>
        <div
          key="Note"
          className="overflow-y-auto overscroll-none col-span-2 border-l p-4"
        >
          <Note note={note} />
        </div>
      </Card>
    </div>
  );
}
