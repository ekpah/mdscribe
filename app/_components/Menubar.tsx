"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import Link from "next/link";
import { useState } from "react";
import { ModeToggle } from "./ModeToggle";

export default function TopMenuBar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => setIsLoggedIn(false);
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
        <div className="absolute right-2 sm:right-4 flex flex-row ">
          <MenubarMenu>
            <MenubarTrigger>
              {isLoggedIn ? (
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src="/placeholder-avatar.jpg"
                    alt="User avatar"
                  />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-8 w-8 p-1 border rounded-full" />
              )}
            </MenubarTrigger>
            <MenubarContent>
              {isLoggedIn ? (
                <>
                  <MenubarItem>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </MenubarItem>
                  <MenubarItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </MenubarItem>
                  <MenubarSeparator />
                  <MenubarItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </MenubarItem>
                </>
              ) : (
                <>
                  <MenubarItem onClick={handleLogin}>Login</MenubarItem>
                  <MenubarItem>Register</MenubarItem>
                </>
              )}
              <MenubarSeparator />
              <MenubarItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <ModeToggle />
        </div>
      </div>
    </Menubar>
  );
}
