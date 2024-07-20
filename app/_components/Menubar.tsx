"use client";

import Link from "next/link";
import * as React from "react";
import { ModeToggle } from "./ModeToggle";

import Logo from "@/public/Logo";

export default function Menubar() {
  return (
    <div
      key="Menubar"
      className="z-1 fixed flex justify-between items-center bottom-[calc(100vh-theme(spacing.16))] left-0 right-0 top-0 h-16 border-b bg-background px-2 sm:px-4 py-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div key="menuBarLinks" className="pl-10 font-light">
          <Link href="/templates/Diverses/Intro">Textbausteine</Link>
        </div>
        <div className="absolute right-2 sm:right-4 ">
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
