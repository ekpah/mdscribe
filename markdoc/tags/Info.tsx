"use client";

import { useInfoStore } from "@/state/infoStoreProvider";

export default function Info({ variable }) {
  // TODO: error, if variable does not exist
  const info = useInfoStore((state) => state[variable]);
  return <span>{info}</span>;
}
