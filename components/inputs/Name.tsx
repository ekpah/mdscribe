"use client";
import { useInfoStore } from "@/state/infoStoreProvider";
import { Input } from "../ui/input";

export default function () {
  const name = useInfoStore((state) => state.name);
  const updateName = useInfoStore((state) => state.updateName);
  return <Input value={name} onChange={(e) => updateName(e.target.value)} />;
}
