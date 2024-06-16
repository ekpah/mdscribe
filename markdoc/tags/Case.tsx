"use client";

import React from "react";
import { SwitchContext } from "./Switch";
export function Case({ primary, children }) {
  const value = React.useContext(SwitchContext);
  if (value !== primary) {
    return null;
  }

  return children;
}
