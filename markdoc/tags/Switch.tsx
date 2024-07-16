"use client";
import React from "react";

export const SwitchContext = React.createContext(null);

import { formAtom } from "@/app/templates/[category]/[template]/_components/ContentSection";
import { useInfoStore } from "@/state/infoStoreProvider";

import { useAtom, useAtomValue } from "jotai";
// this component mainly needs to handle reactivity around the Condition

export function Switch({ variable, children }) {
  // TODO: error, if variable does not exist
  const data = useAtomValue(formAtom);
  const value = data[variable];

  return (
    <SwitchContext.Provider value={value}>{children}</SwitchContext.Provider>
  );
}
