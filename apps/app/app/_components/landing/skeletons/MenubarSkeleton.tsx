import { Button } from "@repo/design-system/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@repo/design-system/components/ui/navigation-menu";
import { Loader2, Menu } from "lucide-react";
import Link from "next/link";
import DarkLogo from "@/public/logo/dark";
import LightLogo from "@/public/logo/light";

export default function MenubarSkeleton() {
	return (
		<div className="relative">
			<div className="flex h-16 items-center justify-between border-b bg-background px-2 py-1 sm:px-4">
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
						</NavigationMenuList>
					</NavigationMenu>
				</div>

				{/* Mobile Menu Toggle */}
				<div className="flex md:hidden">
					<Button size="icon" variant="ghost" disabled>
						<Menu className="h-5 w-5" />
					</Button>
				</div>

				{/* Desktop User Controls - Session loading */}
				<div className="hidden items-center gap-2 text-muted-foreground md:flex">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-xs">Laedt...</span>
				</div>
			</div>
		</div>
	);
}
