"use client";

import { useInfoStore } from "@/state/infoStoreProvider";

export function Info({ primary, variable }) {
  // TODO: error, if variable does not exist
  console.log("info", primary, variable);
  const info = useInfoStore((state) => state[primary]);
  return <>{info}</>;
}
