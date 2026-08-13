'use client';

import type { ReactNode } from 'react';
import React from 'react';
import { SwitchContext } from './switch';

export interface CaseProps {
  primary?: string;
  children?: ReactNode;
}

export const Case = ({
  primary,
  children,
}: CaseProps) => {
  const value = React.useContext(SwitchContext);
  if (typeof primary !== 'string' || value !== primary) {
    return null;
  }
  return children;
};
