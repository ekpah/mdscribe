import { auth } from "@/auth";

import Logo from "@/public/Logo";

import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "./ModeToggle";
import { SignIn } from "./SignIn";
import { SignOut } from "./SignOut";

export default async function TopMenuBar() {
  const session = await auth();

  return (
    <div
      key="Menubar"
      className="flex justify-between items-center h-16 border-b bg-background px-2 sm:px-4 py-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        {session?.user ? (
          <div key="menuBarLinks" className="pl-10 font-light flex flex-row">
            <Link href="/templates/cm27xjij0000atvlt77tdkvrl">
              Meine Textbausteine
            </Link>
            <Link
              className="pl-4"
              href="/createTemplate/cm27xjij0000atvlt77tdkvrl"
            >
              Textbaustein erstellen
            </Link>
          </div>
        ) : (
          <div key="menuBarLinks" className="pl-10 font-light">
            <Link href="/templates/cm27xjij0000atvlt77tdkvrl">
              Textbausteine
            </Link>
          </div>
        )}
        <div className="ml-auto flex items-center space-x-4"></div>

        <div className="absolute right-2 sm:right-4 flex flex-row">
          <div className="mx-4 items-center flex flex-row">
            <p className="mx-4">{session?.user?.email}</p>
            {session?.user ? <SignOut /> : <SignIn />}
          </div>
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
