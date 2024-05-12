"use client";

import { useInfoStore } from "@/state/infoStoreProvider";

export default function Info({ primary, variable }) {
  // TODO: error, if variable does not exist
  console.log(primary, variable);
  const info = useInfoStore((state) => state[primary]);
  return <span>{info}</span>;
}
