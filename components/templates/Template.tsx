"use client";

import UndefinedTemplate from "@/components/templates/UndefinedTemplate";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { create } from "zustand";
import { Button } from "../ui/button";

export default function Template({ children }: { children: React.ReactNode }) {
  const useBearStore = create((set) => ({
    bears: 0,
    increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
  }));
  const increasePopulation = useBearStore((state) => state.increasePopulation);

  return (
    <div className="flex h-full w-full justify-items-stretch">
      <div className="h-full w-1/2 overflow-y-auto p-4 prose">
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" />
          <Label htmlFor="airplane-mode">Airplane Mode</Label>
        </div>
        <div>
          <Button onClick={increasePopulation}>Bären</Button>
        </div>
      </div>
      <div className="h-full w-1/2 overflow-y-auto border-l p-4 prose">
        <div>{children ? children : <UndefinedTemplate />}</div>
      </div>
    </div>
  );
}
