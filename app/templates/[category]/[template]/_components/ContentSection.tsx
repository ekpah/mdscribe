"use client";
import { Card } from "@/components/ui/card";
import { inputComponents } from "@/inputs/index.js";
import { FormContextProvider } from "@/state/FormContext";
import { atom, useAtom } from "jotai";
import React, { useContext, useState } from "react";
import { useFieldArray, useForm, useFormContext } from "react-hook-form";
import Inputs from "./Inputs";
import Note from "./Note";

export const formAtom = atom({});

export default function ContentSection({
  note,
  inputs = "[]",
}: {
  note: string;
  inputs: string;
}) {
  const [formData, setFormData] = useAtom(formAtom);

  const handleFormChange = (data) => {
    setFormData(data);
  };
  return (
    <div className="flex h-full w-full justify-items-stretch">
      <div className="h-full w-1/2 overflow-y-auto p-4 prose prose-slate">
        <Inputs inputs={inputs} onChange={handleFormChange} />
      </div>
      <Note note={note} />
    </div>
  );
}
