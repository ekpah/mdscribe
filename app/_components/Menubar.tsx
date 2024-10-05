"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import Logo from "@/public/Logo";
import { HelpCircle, LogOut, Settings, User } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { ModeToggle } from "./ModeToggle";
import { SignIn } from "./SignIn";
import { SignOut } from "./SignOut";

export default function TopMenuBar() {
  const { data: session } = useSession();

  return (
    <Menubar
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
        <div className="ml-auto flex items-center space-x-4"></div>

        <div className="absolute right-2 sm:right-4 flex flex-row">
          <div className="mx-4 items-center">
            {true ? <SignOut /> : <SignIn />}
          </div>
          <ModeToggle />
        </div>
      </div>
    </Menubar>
  );
}
