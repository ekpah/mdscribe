"use client";
import { Input } from "@/components/ui/input";
import { useInfoStore } from "@/state/infoStoreProvider";

export default function Name() {
  const name = useInfoStore((state) => state.name);
  const updateName = useInfoStore((state) => state.updateName);
  return <Input value={name} onChange={(e) => updateName(e.target.value)} />;
}
