"use client";
import { atom, useAtom } from "jotai";
import React from "react";

import Inputs from "./Inputs";
import Note from "./Note";

export const formAtom = atom({});

export default function ContentSection({
  note,
  inputTags = "[]",
}: {
  note: string;
  inputTags: string;
}) {
  const [formData, setFormData] = useAtom(formAtom);

  const handleFormChange = (data) => {
    setFormData(data);
  };
  return (
    <div className="grid grid-cols-3 h-full w-full">
      <div key="Inputs" className="overflow-y-auto p-4">
        <Inputs inputTags={inputTags} onChange={handleFormChange} />
      </div>
      <div key="Note" className="overflow-y-auto col-span-2 border-l p-4">
        <Note note={note} />
      </div>
    </div>
  );
}
