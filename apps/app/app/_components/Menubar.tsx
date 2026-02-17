"use client";

import { ModeToggleSwitch } from "@repo/design-system/components/mode-toggle";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@repo/design-system/components/ui/navigation-menu";
import { cn } from "@repo/design-system/lib/utils";
import {
	LayoutDashboard,
	Loader2,
	LogOut,
	Menu,
	Settings,
	Shield,
	User,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";
import DarkLogo from "@/public/logo/dark";
import LightLogo from "@/public/logo/light";

type TopMenuBarProperties = {
	initialSession: Session | null;
	isAdmin?: boolean;
};

export default function TopMenuBar({ initialSession, isAdmin }: TopMenuBarProperties) {
	const router = useRouter();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const sessionQuery = useSession();
	const session =
		sessionQuery.data !== undefined ? sessionQuery.data : initialSession;
	const isSessionLoading = sessionQuery.isPending && session === null;
	const showAiLink = !!session?.user;

	const signInUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;

	const handleSignOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.refresh();
					router.push("/");
				},
			},
		});
	};

	const toggleMobileMenu = () => {
		setMobileMenuOpen(!mobileMenuOpen);
	};

	return (
		<div className="relative">
			<div
				className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
				key="Menubar"
			>
				<div className="flex items-center">
					<Link className="mr-4" href="/">
						<div className="dark:hidden">
							<LightLogo />
						</div>
						<div className="hidden dark:block">
							<DarkLogo />
						</div>
					</Link>

					{/* Desktop Navigation */}
					<NavigationMenu className="hidden md:block">
						<NavigationMenuList>
							<NavigationMenuItem>
								<NavigationMenuLink
									className={navigationMenuTriggerStyle()}
									href="/templates"
								>
									Textbausteine
								</NavigationMenuLink>
							</NavigationMenuItem>
							{showAiLink && (
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										href="/aiscribe"
									>
										AI Scribe
									</NavigationMenuLink>
								</NavigationMenuItem>
							)}
						</NavigationMenuList>
					</NavigationMenu>
				</div>

				{/* Mobile Menu Toggle */}
				<div className="flex md:hidden">
					<Button onClick={toggleMobileMenu} size="icon" variant="ghost">
						{mobileMenuOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</Button>
				</div>

				{/* Desktop User Controls */}
				<div className="hidden items-center gap-2 md:flex">
					{isSessionLoading ? (
						<Button
							variant="ghost"
							className="relative h-9 w-9 rounded-full"
							disabled
						>
							<Avatar className="h-9 w-9 opacity-70">
								<AvatarFallback>
									<User className="h-5 w-5" />
								</AvatarFallback>
							</Avatar>
							<Loader2 className="absolute h-4 w-4 animate-spin text-muted-foreground" />
						</Button>
					) : session?.user ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="relative h-9 w-9 rounded-full"
								>
									<Avatar className="h-9 w-9">
										<AvatarImage
											src={session.user.image ?? undefined}
											alt={session.user.name ?? session.user.email}
										/>
										<AvatarFallback>
											<User className="h-5 w-5" />
										</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col space-y-1">
										{session.user.name && (
											<p className="font-medium text-sm leading-none">
												{session.user.name}
											</p>
										)}
										<p className="text-muted-foreground text-xs leading-none">
											{session.user.email}
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/dashboard" className="cursor-pointer">
										<LayoutDashboard className="mr-2 h-4 w-4" />
										Dashboard
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/profile" className="cursor-pointer">
										<Settings className="mr-2 h-4 w-4" />
										Einstellungen
									</Link>
								</DropdownMenuItem>
								{isAdmin && (
									<DropdownMenuItem asChild>
										<Link href="/admin" className="cursor-pointer">
											<Shield className="mr-2 h-4 w-4" />
											Admin
										</Link>
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<ModeToggleSwitch />
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={handleSignOut}
									className="cursor-pointer"
								>
									<LogOut className="mr-2 h-4 w-4" />
									Ausloggen
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<Link href={signInUrl}>
							<Button>Anmelden</Button>
						</Link>
					)}
				</div>
			</div>

			{/* Mobile Menu */}
			<div
				className={cn(
					"absolute right-0 left-0 z-50 flex flex-col border-b bg-background shadow-lg md:hidden",
					mobileMenuOpen ? "block" : "hidden",
				)}
			>
				<div className="flex flex-col space-y-3 p-4">
					<NavigationMenu>
						<NavigationMenuList className="flex flex-col space-y-2">
							<NavigationMenuItem>
								<NavigationMenuLink
									className={navigationMenuTriggerStyle()}
									href="/templates"
								>
									Textbausteine
								</NavigationMenuLink>
							</NavigationMenuItem>
							{showAiLink && (
								<NavigationMenuItem>
									<NavigationMenuLink
										className={navigationMenuTriggerStyle()}
										href="/aiscribe"
									>
										AI Scribe
									</NavigationMenuLink>
								</NavigationMenuItem>
							)}
						</NavigationMenuList>
					</NavigationMenu>
					<div className="mt-2 border-t pt-3">
						{isSessionLoading ? (
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-between px-2">
									<ModeToggleSwitch />
								</div>
								<div className="flex items-center justify-center py-2">
									<div className="relative">
										<Avatar className="h-10 w-10 opacity-70">
											<AvatarFallback>
												<User className="h-5 w-5" />
											</AvatarFallback>
										</Avatar>
										<Loader2 className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
									</div>
								</div>
							</div>
						) : session?.user ? (
							<>
								<div className="mb-3 flex items-center gap-3 px-2">
									<Avatar className="h-10 w-10">
										<AvatarImage
											src={session.user.image ?? undefined}
											alt={session.user.name ?? session.user.email}
										/>
										<AvatarFallback>
											<User className="h-5 w-5" />
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col">
										{session.user.name && (
											<span className="font-medium text-sm">
												{session.user.name}
											</span>
										)}
										<span className="text-muted-foreground text-xs">
											{session.user.email}
										</span>
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<Link
										href="/dashboard"
										onClick={() => setMobileMenuOpen(false)}
										className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
									>
										<LayoutDashboard className="h-4 w-4" />
										Dashboard
									</Link>
									<Link
										href="/profile"
										onClick={() => setMobileMenuOpen(false)}
										className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
									>
										<Settings className="h-4 w-4" />
										Einstellungen
									</Link>
									{isAdmin && (
										<Link
											href="/admin"
											onClick={() => setMobileMenuOpen(false)}
											className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
										>
											<Shield className="h-4 w-4" />
											Admin
										</Link>
									)}
								</div>
								<div className="mt-3 flex flex-col gap-3">
									<div className="flex items-center justify-between px-2">
										<ModeToggleSwitch />
									</div>
									<Button
										className="w-full"
										onClick={handleSignOut}
										variant="secondary"
									>
										<LogOut className="mr-2 h-4 w-4" />
										Ausloggen
									</Button>
								</div>
							</>
						) : (
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-between px-2">
									<ModeToggleSwitch />
								</div>
								<Link
									className="w-full"
									href={signInUrl}
									onClick={() => setMobileMenuOpen(false)}
								>
									<Button className="w-full">Jetzt anmelden</Button>
								</Link>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
