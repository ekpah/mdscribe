"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore, type StoreApi } from "zustand";

import { createInfoStore, type InfoStore } from "@/state/infoStore";

export const InfoStoreContext = createContext<StoreApi<InfoStore> | null>(null);

export interface InfoStoreProviderProps {
  children: ReactNode;
}

export const InfoStoreProvider = ({ children }: InfoStoreProviderProps) => {
  const storeRef = useRef<StoreApi<InfoStore>>();
  if (!storeRef.current) {
    storeRef.current = createInfoStore();
  }
  return (
    <InfoStoreContext.Provider value={storeRef.current}>
      {children}
    </InfoStoreContext.Provider>
  );
};

export const useInfoStore = <T,>(selector: (store: InfoStore) => T): T => {
  const infoStoreContext = useContext(InfoStoreContext);
  if (!infoStoreContext) {
    throw new Error(`useInfoStore must be use within InfoStoreProvider`);
  }

  return useStore(infoStoreContext, selector);
};
