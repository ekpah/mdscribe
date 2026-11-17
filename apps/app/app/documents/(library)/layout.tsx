import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
	return <main className="h-full min-w-0 w-full p-2">{children}</main>;
}
