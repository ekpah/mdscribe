'use client';
import { InfoStoreProvider } from '@/state/infoStoreProvider';
import type { ReactNode } from 'react';

type RootLayoutProperties = {
  readonly children: ReactNode;
};

export default function Providers({ children }: RootLayoutProperties) {
  return <InfoStoreProvider>{children}</InfoStoreProvider>;
}
