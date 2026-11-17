"use client";

import { ModeToggleSwitch } from "@repo/design-system/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	FolderOpen,
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
import { useCallback, useState } from "react";

import { useCase } from "@/app/_components/input-context/case-context";
import { getTextContextFieldCount } from "@/app/_components/input-context/inputs/text/text-input";
import { authClient, useSession } from "@/lib/auth-client";
import type { Session } from "@/lib/auth-types";
import { orpc } from "@/lib/orpc";
import { sessionQueryKey } from "@/lib/session-query";
import Logo from "@/public/logo";

// Left-aligned and full width, so the links line up with the account links below them.
const mobileNavLinkClassName = cn(navigationMenuTriggerStyle(), "w-full justify-start px-2");

const countLabel = (count: number, one: string, many: string) =>
	count ? [`${count} ${count === 1 ? one : many}`] : [];

/** The case shared by template, AI Scribe and PDF form pages; shown while it holds input. */
const CaseMenu = () => {
	const caseInput = useCase();
	if (!caseInput.hasAnyContext) {
		return null;
	}
	const summary = [
		...countLabel(getTextContextFieldCount(caseInput.textContext), "Text", "Texte"),
		...countLabel(caseInput.contextFiles.length, "Datei", "Dateien"),
		...countLabel(caseInput.audioRecordings.length, "Aufnahme", "Aufnahmen"),
	].join(" · ");
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger
				render={
					<Button aria-label={`Aktueller Fall: ${summary}`} size="sm" variant="outline">
						<FolderOpen className="size-4" />
						<span className="max-sm:hidden">Fall · {summary}</span>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-64">
				<p className="px-2 py-1.5 text-muted-foreground text-xs">
					Text, Audio und Dateien dieses Falls bleiben erhalten, während du die Vorlage wechselst.
				</p>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={caseInput.clear}>Neuer Fall (alles leeren)</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

interface TopMenuBarProperties {
	initialIsAdmin?: boolean;
	initialSession: Session | null;
}

const getUserDisplayName = (session: Session | null): string => {
	const user = session?.user;
	if (user) {
		return user.name?.trim() || user.email.split("@")[0] || user.email;
	}

	return "";
};

export default function TopMenuBar({
	initialIsAdmin = false,
	initialSession,
}: TopMenuBarProperties) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { clear: clearCase } = useCase();

	const sessionQuery = useSession();
	const session = sessionQuery.data === undefined ? initialSession : sessionQuery.data;
	const authQuery = useQuery({
		...orpc.user.auth.queryOptions(),
		enabled: Boolean(session?.user) && !initialIsAdmin,
	});
	const isSessionLoading = sessionQuery.isPending && session === null;
	const isLoggedIn = Boolean(session?.user);
	const isAdmin = Boolean(session?.user) && (initialIsAdmin || (authQuery.data?.isAdmin ?? false));
	const userDisplayName = getUserDisplayName(session);

	const signInUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;

	const handleSignOutSuccess = useCallback(() => {
		clearCase();
		queryClient.setQueryData(sessionQueryKey, null);
		router.refresh();
		router.push("/");
	}, [clearCase, queryClient, router]);

	const handleSignOut = useCallback(async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: handleSignOutSuccess,
			},
		});
	}, [handleSignOutSuccess]);

	const toggleMobileMenu = useCallback(() => {
		setMobileMenuOpen((prev) => !prev);
	}, []);

	const closeMobileMenu = useCallback(() => {
		setMobileMenuOpen(false);
	}, []);

	return (
		<div className="relative">
			<div
				className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4"
				key="Menubar"
			>
				<div className="flex items-center">
					<Link className="mr-4" href="/">
						<Logo />
					</Link>

					{/* Desktop Navigation */}
					<NavigationMenu className="hidden md:block">
						<NavigationMenuList>
							<NavigationMenuItem>
								<NavigationMenuLink
									className={navigationMenuTriggerStyle()}
									render={<Link href="/templates" />}
								>
									Vorlagen
								</NavigationMenuLink>
							</NavigationMenuItem>
							{isLoggedIn && (
								<>
									<NavigationMenuItem>
										<NavigationMenuLink
											className={navigationMenuTriggerStyle()}
											render={<Link href="/aiscribe" />}
										>
											AI Scribe
										</NavigationMenuLink>
									</NavigationMenuItem>
									<NavigationMenuItem>
										<NavigationMenuLink
											className={navigationMenuTriggerStyle()}
											render={<Link href="/collections" />}
										>
											Sammlungen
										</NavigationMenuLink>
									</NavigationMenuItem>
								</>
							)}
						</NavigationMenuList>
					</NavigationMenu>
				</div>

				<div className="flex items-center gap-2">
					<CaseMenu />
					{/* Mobile Menu Toggle */}
					<div className="flex md:hidden">
						<Button onClick={toggleMobileMenu} size="icon" variant="ghost">
							{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
						</Button>
					</div>

					{/* Desktop User Controls */}
					<div className="hidden items-center gap-2 md:flex">
						{(() => {
							if (isSessionLoading) {
								return (
									<Button variant="ghost" className="relative h-9 w-9 rounded-full" disabled>
										<Avatar className="h-9 w-9 opacity-70">
											<AvatarFallback>
												<User className="h-5 w-5" />
											</AvatarFallback>
										</Avatar>
										<Loader2 className="absolute h-4 w-4 animate-spin text-muted-foreground" />
									</Button>
								);
							}

							if (session?.user) {
								return (
									<DropdownMenu modal={false}>
										<DropdownMenuTrigger
											render={
												<Button variant="ghost" className="relative h-9 w-9 rounded-full">
													<Avatar className="h-9 w-9">
														<AvatarImage
															src={session.user.image ?? undefined}
															alt={userDisplayName}
														/>
														<AvatarFallback>
															<User className="h-5 w-5" />
														</AvatarFallback>
													</Avatar>
												</Button>
											}
										/>
										<DropdownMenuContent align="end" className="w-56">
											<DropdownMenuLabel className="font-normal">
												<div className="flex flex-col space-y-1">
													<p className="font-medium text-sm leading-none">{userDisplayName}</p>
													<p className="text-muted-foreground text-xs leading-none">
														{session.user.email}
													</p>
												</div>
											</DropdownMenuLabel>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												render={
													<Link href="/dashboard" className="cursor-pointer">
														<LayoutDashboard className="mr-2 h-4 w-4" />
														Dashboard
													</Link>
												}
											/>
											<DropdownMenuItem
												render={
													<Link href="/profile/account" className="cursor-pointer">
														<Settings className="mr-2 h-4 w-4" />
														Einstellungen
													</Link>
												}
											/>
											{isAdmin && (
												<DropdownMenuItem
													render={
														<Link href="/admin" className="cursor-pointer">
															<Shield className="mr-2 h-4 w-4" />
															Admin
														</Link>
													}
												/>
											)}
											<DropdownMenuSeparator />
											<ModeToggleSwitch />
											<DropdownMenuSeparator />
											<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
												<LogOut className="mr-2 h-4 w-4" />
												Ausloggen
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								);
							}

							return (
								<Link href={signInUrl}>
									<Button>Anmelden</Button>
								</Link>
							);
						})()}
					</div>
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
					<NavigationMenu className="max-w-none">
						<NavigationMenuList className="flex flex-col items-stretch space-y-2">
							<NavigationMenuItem>
								<NavigationMenuLink
									className={mobileNavLinkClassName}
									onClick={closeMobileMenu}
									render={<Link href="/templates" />}
								>
									Vorlagen
								</NavigationMenuLink>
							</NavigationMenuItem>
							{isLoggedIn && (
								<>
									<NavigationMenuItem>
										<NavigationMenuLink
											className={mobileNavLinkClassName}
											onClick={closeMobileMenu}
											render={<Link href="/aiscribe" />}
										>
											AI Scribe
										</NavigationMenuLink>
									</NavigationMenuItem>
									<NavigationMenuItem>
										<NavigationMenuLink
											className={mobileNavLinkClassName}
											onClick={closeMobileMenu}
											render={<Link href="/collections" />}
										>
											Sammlungen
										</NavigationMenuLink>
									</NavigationMenuItem>
								</>
							)}
						</NavigationMenuList>
					</NavigationMenu>
					<div className="mt-2 border-t pt-3">
						{(() => {
							if (isSessionLoading) {
								return (
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
								);
							}

							if (session?.user) {
								return (
									<>
										<div className="mb-3 flex items-center gap-3 px-2">
											<Avatar className="h-10 w-10">
												<AvatarImage src={session.user.image ?? undefined} alt={userDisplayName} />
												<AvatarFallback>
													<User className="h-5 w-5" />
												</AvatarFallback>
											</Avatar>
											<div className="flex flex-col">
												<span className="font-medium text-sm">{userDisplayName}</span>
												<span className="text-muted-foreground text-xs">{session.user.email}</span>
											</div>
										</div>
										<div className="flex flex-col gap-1">
											<Link
												href="/dashboard"
												onClick={closeMobileMenu}
												className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
											>
												<LayoutDashboard className="h-4 w-4" />
												Dashboard
											</Link>
											<Link
												href="/profile/account"
												onClick={closeMobileMenu}
												className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
											>
												<Settings className="h-4 w-4" />
												Einstellungen
											</Link>
											{isAdmin && (
												<Link
													href="/admin"
													onClick={closeMobileMenu}
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
											<Button className="w-full" onClick={handleSignOut} variant="secondary">
												<LogOut className="mr-2 h-4 w-4" />
												Ausloggen
											</Button>
										</div>
									</>
								);
							}

							return (
								<div className="flex flex-col gap-3">
									<div className="flex items-center justify-between px-2">
										<ModeToggleSwitch />
									</div>
									<Link className="w-full" href={signInUrl} onClick={closeMobileMenu}>
										<Button className="w-full">Jetzt anmelden</Button>
									</Link>
								</div>
							);
						})()}
					</div>
				</div>
			</div>
		</div>
	);
}
