"use client";

import { SidebarProvider, SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { KeyRound, Settings, Sparkles, Type, UserCircle } from "lucide-react";
import type { ReactNode } from "react";

import {
	NavigationSidebar,
	NavigationSidebarBrand,
} from "@/app/_components/sidebar/navigation-sidebar";
import type { NavigationSidebarSection } from "@/app/_components/sidebar/navigation-sidebar";

const settingsSections: NavigationSidebarSection[] = [
	{
		items: [
			{
				href: "/profile/account",
				icon: UserCircle,
				title: "Account",
			},
			{
				href: "/profile/texteditor",
				icon: Type,
				title: "Texteditor",
			},
			{
				href: "/profile/ai-scribe",
				icon: Sparkles,
				title: "AI-Scribe",
			},
			{
				href: "/profile/ai-access",
				icon: KeyRound,
				title: "KI-Zugang",
			},
		],
		key: "profile-settings",
		title: "Einstellungen",
	},
];

interface ProfileSettingsShellProps {
	readonly children: ReactNode;
}

export const ProfileSettingsShell = ({ children }: ProfileSettingsShellProps) => (
	<div className="flex h-full min-h-0 w-full bg-solarized-base3">
		<SidebarProvider className="h-full min-h-0">
			<NavigationSidebar
				className="top-16 h-[calc(100vh-(--spacing(16)))]"
				header={
					<NavigationSidebarBrand
						href="/profile/account"
						icon={Settings}
						subtitle="Account, Texteditor, AI-Scribe und KI-Zugang"
						title="Einstellungen"
					/>
				}
				sections={settingsSections}
				variant="flat"
			/>
			<main className="flex h-full min-h-0 grow overflow-y-auto p-4 sm:p-6">
				<div className="mx-auto w-full max-w-4xl space-y-4">
					<div className="flex items-center gap-2 md:hidden">
						<SidebarTrigger />
						<span className="font-medium text-solarized-base00 text-sm">Einstellungen</span>
					</div>
					{children}
				</div>
			</main>
		</SidebarProvider>
	</div>
);
