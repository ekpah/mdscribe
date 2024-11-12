'use client';

import type { ReactNode } from 'React';
import React from 'react';
import { SwitchContext } from './Switch';
export function Case({
  primary,
  children,
}: { primary: string; children: ReactNode[] }) {
  const value = React.useContext(SwitchContext);
  if (value !== primary) {
    return null;
  }

  return children;
}
