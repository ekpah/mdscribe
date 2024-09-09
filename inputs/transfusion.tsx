"use client";

import { Checkbox } from "@/components/ui/checkbox";

export default function Transfusion() {
  return (
    <div className="items-top flex space-x-2">
      <Checkbox id="transfusion" />
      <div className="grid gap-1.5 leading-none">
        <label
          htmlFor="transfusion"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Transfusion notwendig
        </label>
      </div>
    </div>
  );
}
