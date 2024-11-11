"use client";

import React, { createContext, useContext, useState } from "react";

export const FormContext = createContext({});

export const FormContextProvider = ({ children, defaultValue = {} }) => {
  return (
    <FormContext.Provider value={defaultValue}>{children}</FormContext.Provider>
  );
};
