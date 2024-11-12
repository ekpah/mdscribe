'use client';

import type { ReactNode } from 'react';
import { createContext } from 'react';

export const FormContext = createContext({});

export const FormContextProvider = ({
  children,
  defaultValue = {},
}: { children: ReactNode; defaultValue: {} }) => {
  return (
    <FormContext.Provider value={defaultValue}>{children}</FormContext.Provider>
  );
};
