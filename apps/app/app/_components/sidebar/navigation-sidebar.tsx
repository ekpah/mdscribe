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
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { ChevronRight, Minus, Plus, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
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

interface NavigationSidebarSearchProps {
	readonly id: string;
	readonly label: string;
	readonly placeholder: string;
	readonly value: string;
	readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	readonly className?: string;
	readonly iconPosition?: "left" | "right";
	readonly trailing?: ReactNode;
}

export const NavigationSidebarBrand = ({
	href,
	icon: Icon,
	title,
	subtitle,
}: NavigationSidebarBrandProps) => (
	<SidebarMenu>
		<SidebarMenuItem>
			<SidebarMenuButton asChild size="lg">
				<Link href={href}>
					<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
						<Icon className="size-4" />
					</div>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-semibold">{title}</span>
						{subtitle ? <span className="truncate text-xs">{subtitle}</span> : null}
					</div>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	</SidebarMenu>
);

export const NavigationSidebarSearch = ({
	id,
	label,
	placeholder,
	value,
	onChange,
	className,
	iconPosition = "right",
	trailing,
}: NavigationSidebarSearchProps) => (
	<form>
		<SidebarGroup className="py-0">
			<SidebarGroupContent className="relative">
				<label className="sr-only" htmlFor={id}>
					{label}
				</label>
				<SidebarInput
					className={cn(iconPosition === "left" && "pl-8", className)}
					id={id}
					onChange={onChange}
					placeholder={placeholder}
					value={value}
				/>
				<Search
					className={cn(
						"pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 select-none opacity-50",
						iconPosition === "left" ? "left-2" : "right-3",
					)}
				/>
				{trailing}
			</SidebarGroupContent>
		</SidebarGroup>
	</form>
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
											const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

											return (
												<SidebarMenuItem key={item.key ?? item.href}>
													<SidebarMenuButton asChild isActive={isActive}>
														<Link href={href} onClick={handleCloseMobile}>
															{Icon ? <Icon /> : null}
															<span>{item.title}</span>
															{renderItemMeta?.(item)}
														</Link>
													</SidebarMenuButton>
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
													<CollapsibleTrigger asChild>
														<SidebarMenuButton className={sectionButtonClassName}>
															{SectionIcon ? <SectionIcon /> : null}
															<span>{section.title || sectionTitleFallback}</span>
															{expandIcon === "chevron" ? (
																<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
															) : (
																<>
																	<Plus className="ml-auto group-data-[state=open]/collapsible:hidden" />
																	<Minus className="ml-auto group-data-[state=closed]/collapsible:hidden" />
																</>
															)}
														</SidebarMenuButton>
													</CollapsibleTrigger>
													{section.items.length > 0 ? (
														<CollapsibleContent>
															<SidebarMenuSub>
																{section.items.map((item) => {
																	const href = resolveHref(item);

																	return (
																		<SidebarMenuSubItem key={item.key ?? item.href}>
																			<SidebarMenuSubButton asChild>
																				<Link
																					className="flex items-center justify-between"
																					href={href}
																					onClick={handleCloseMobile}
																				>
																					<span>{item.title}</span>
																					{renderItemMeta?.(item)}
																				</Link>
																			</SidebarMenuSubButton>
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

export const groupNavigationItemsByCategory = <
	TItem extends {
		readonly category: string;
		readonly title: string;
		readonly url: string;
		readonly favouritesCount?: number;
	},
>(
	items: readonly TItem[],
): NavigationSidebarSection[] => {
	const groups = new Map<string, NavigationSidebarItem[]>();

	for (const item of items) {
		const existing = groups.get(item.category) ?? [];
		existing.push({
			count: item.favouritesCount,
			href: item.url,
			title: item.title,
		});
		groups.set(item.category, existing);
	}

	return [...groups.entries()]
		.map(([category, categoryItems]) => ({
			items: categoryItems.toSorted((a, b) => a.title.localeCompare(b.title)),
			key: category,
			title: category,
		}))
		.toSorted((a, b) => a.title.localeCompare(b.title));
};
