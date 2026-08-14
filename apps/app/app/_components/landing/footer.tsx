import { Github } from "lucide-react";
import Link from "next/link";

import { USER_MESSAGES } from "@/lib/user-messages";

export const Footer = () => {
	const content = USER_MESSAGES.landing.footer;
	const year = new Date().getFullYear();

	return (
		<footer className="border-t px-5 pt-8 pb-24 sm:px-8 lg:px-10">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="font-semibold text-lg tracking-tight">{content.brand}</p>
					<p className="mt-1 max-w-md font-sans text-muted-foreground text-sm leading-relaxed">
						{content.tagline}
					</p>
				</div>

				<div className="flex flex-col gap-3 text-muted-foreground text-sm sm:items-end">
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<Link
							className="flex items-center gap-1.5 transition-colors hover:text-foreground"
							href="https://github.com/ekpah/mdscribe"
							rel="noopener noreferrer"
							target="_blank"
						>
							<Github className="size-4" />
							{content.github}
						</Link>
						<Link className="transition-colors hover:text-foreground" href="/legal">
							{content.legal}
						</Link>
					</div>
					<p className="font-mono text-xs">
						© {year} {content.brand}
					</p>
				</div>
			</div>
		</footer>
	);
};
