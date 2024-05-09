"use client";

import DefaultNote from "@/app/templates/_components/DefaultNote";

export default function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-1/2 overflow-y-auto border-l p-4 prose prose-slate">
      <div>{children ? children : <DefaultNote />}</div>
    </div>
  );
}
