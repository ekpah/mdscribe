"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { ChevronRight, Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback } from "react";

export interface NavigationSidebarItem {
	readonly key?: string;
	readonly title: string;
	readonly href: string;
	readonly icon?: LucideIcon;
	readonly count?: number;
}

export interface NavigationSidebarSection {
	readonly key?: string;
	readonly title: string;
	readonly icon?: LucideIcon;
	readonly items: readonly NavigationSidebarItem[];
	readonly defaultOpen?: boolean;
}

interface NavigationSidebarProps {
	readonly className?: string;
	readonly header?: ReactNode;
	readonly controls?: ReactNode;
	readonly contentClassName?: string;
	readonly menuClassName?: string;
	readonly sections: readonly NavigationSidebarSection[];
	readonly variant?: "grouped" | "flat";
	readonly expandIcon?: "chevron" | "plus-minus";
	readonly sectionTitleFallback?: string;
	readonly sectionButtonClassName?: string;
	readonly getItemHref?: (item: NavigationSidebarItem) => string;
	readonly renderItemMeta?: (item: NavigationSidebarItem) => ReactNode;
	readonly emptyState?: ReactNode;
}

interface NavigationSidebarBrandProps {
	readonly href: string;
	readonly icon: LucideIcon;
	readonly title: string;
	readonly subtitle?: string;
}

export const NavigationSidebarBrand = ({
	href,
	icon: Icon,
	title,
	subtitle,
}: NavigationSidebarBrandProps) => (
	<SidebarMenu>
		<SidebarMenuItem>
			<SidebarMenuButton
				size="lg"
				render={
					<Link href={href}>
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
							<Icon className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">{title}</span>
							{subtitle ? <span className="truncate text-xs">{subtitle}</span> : null}
						</div>
					</Link>
				}
			/>
		</SidebarMenuItem>
	</SidebarMenu>
);

export const NavigationSidebar = ({
	className,
	header,
	controls,
	contentClassName,
	menuClassName,
	sections,
	variant = "grouped",
	expandIcon = "chevron",
	sectionTitleFallback = "Diverses",
	sectionButtonClassName,
	getItemHref,
	renderItemMeta,
	emptyState,
}: NavigationSidebarProps) => {
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();
	const resolveHref = useCallback(
		(item: NavigationSidebarItem) => getItemHref?.(item) ?? item.href,
		[getItemHref],
	);
	const handleCloseMobile = useCallback(() => {
		setOpenMobile(false);
	}, [setOpenMobile]);

	return (
		<Sidebar className={className} collapsible="offcanvas">
			{header || controls ? (
				<SidebarHeader>
					{header}
					{controls}
				</SidebarHeader>
			) : null}
			<SidebarContent className={contentClassName}>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className={menuClassName}>
							{variant === "flat"
								? sections.flatMap((section) =>
										section.items.map((item) => {
											const Icon = item.icon;
											const href = resolveHref(item);
											const isActive =
												pathname === item.href || pathname.startsWith(`${item.href}/`);

											return (
												<SidebarMenuItem key={item.key ?? item.href}>
													<SidebarMenuButton
														isActive={isActive}
														render={
															<Link href={href} onClick={handleCloseMobile}>
																{Icon ? <Icon /> : null}
																<span>{item.title}</span>
																{renderItemMeta?.(item)}
															</Link>
														}
													/>
												</SidebarMenuItem>
											);
										}),
									)
								: sections.map((section) => {
										const SectionIcon = section.icon;

										return (
											<Collapsible
												className="group/collapsible"
												defaultOpen={section.defaultOpen ?? true}
												key={section.key ?? (section.title || "uncategorized")}
											>
												<SidebarMenuItem>
													<CollapsibleTrigger
														render={
															<SidebarMenuButton className={sectionButtonClassName}>
																{SectionIcon ? <SectionIcon /> : null}
																<span>{section.title || sectionTitleFallback}</span>
																{expandIcon === "chevron" ? (
																	<ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
																) : (
																	<>
																		<Plus className="ml-auto group-data-open/collapsible:hidden" />
																		<Minus className="ml-auto group-data-closed/collapsible:hidden" />
																	</>
																)}
															</SidebarMenuButton>
														}
													/>
													{section.items.length > 0 ? (
														<CollapsibleContent>
															<SidebarMenuSub>
																{section.items.map((item) => {
																	const href = resolveHref(item);

																	return (
																		<SidebarMenuSubItem key={item.key ?? item.href}>
																			<SidebarMenuSubButton
																				render={
																					<Link
																						className="flex items-center justify-between"
																						href={href}
																						onClick={handleCloseMobile}
																					>
																						<span>{item.title}</span>
																						{renderItemMeta?.(item)}
																					</Link>
																				}
																			/>
																		</SidebarMenuSubItem>
																	);
																})}
															</SidebarMenuSub>
														</CollapsibleContent>
													) : null}
												</SidebarMenuItem>
											</Collapsible>
										);
									})}
						</SidebarMenu>
						{sections.length === 0 ? emptyState : null}
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
};
