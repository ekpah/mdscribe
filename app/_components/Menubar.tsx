"use client";

import { ModeToggle } from "@/components/ModeToggle";
import Link from "next/link";
import * as React from "react";

import Logo from "@/public/Logo";

export default function Menubar() {
  return (
    <div
      key="Menubar"
      className="z-1 fixed bottom-[calc(100vh-theme(spacing.16))] left-0 right-0 top-0 h-16 w-full border-b bg-background px-2 py-3 sm:px-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center">
            <Logo />
            <span className="whitespace-nowrap text-xl font-semibold">
              Scribe
            </span>
          </Link>
          <Link href="/templates">Vorlagen</Link>
        </div>
        <ModeToggle />
      </div>
    </div>
  );
}
