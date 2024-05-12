"use client";
import React from "react";

export const SwitchContext = React.createContext();

import { useInfoStore } from "@/state/infoStoreProvider";

// this component mainly needs to handle reactivity around the Condition

export default function Switch({ variable, children }) {
  // TODO: error, if variable does not exist

  const value = useInfoStore((state) => state[variable]);

  return (
    <SwitchContext.Provider value={value}>{children}</SwitchContext.Provider>
  );
}
