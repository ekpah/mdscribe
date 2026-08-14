"use client";

import { buttonVariants } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowDown, ArrowRight, Check, Github } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { USER_MESSAGES } from "@/lib/user-messages";

interface HeroProps {
	isLoggedIn: boolean;
}

const handleFeatureScroll = (event: MouseEvent<HTMLAnchorElement>) => {
	const target = document.querySelector("#markdown");
	if (!target) {
		return;
	}

	event.preventDefault();
	window.history.pushState(null, "", "#markdown");
	target.scrollIntoView({
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
		block: "start",
	});
};

export const Hero = ({ isLoggedIn }: HeroProps) => {
	const content = USER_MESSAGES.landing.hero;

	return (
		<section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b">
			<div
				aria-hidden="true"
				className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
			/>
			<div
				aria-hidden="true"
				className="absolute top-0 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-solarized-blue/10 blur-3xl"
			/>

			<div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col px-5 pt-16 pb-8 sm:px-8 lg:px-10 lg:pt-20">
				<div className="mx-auto flex max-w-4xl flex-col items-center text-center">
					<h1 className="mt-7 max-w-4xl font-bold text-5xl leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-8xl">
						<span className="block">{content.titleLead}</span>
						<span className="block text-solarized-blue">{content.titleAccent}</span>
					</h1>

					<p className="mt-7 max-w-2xl text-balance font-sans text-lg text-muted-foreground leading-relaxed sm:text-xl">
						{content.description}
					</p>

					<div className="mt-8 flex w-full max-w-lg flex-col justify-center gap-3 sm:flex-row">
						<Link
							className={cn(
								buttonVariants({ size: "lg" }),
								"h-11 flex-1 px-5 shadow-lg shadow-solarized-blue/15",
							)}
							href={isLoggedIn ? "/aiscribe" : "/sign-up"}
							id="primary-cta"
						>
							{isLoggedIn ? content.primaryCtaAuthenticated : content.primaryCta}
							<ArrowRight data-icon="inline-end" />
						</Link>
						<Link
							className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 flex-1 px-5")}
							href="https://github.com/ekpah/mdscribe"
							rel="noopener noreferrer"
							target="_blank"
						>
							<Github data-icon="inline-start" />
							{content.githubCta}
						</Link>
					</div>

					<ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-muted-foreground text-sm">
						{content.trust.map((item) => (
							<li className="flex items-center gap-1.5" key={item}>
								<Check className="size-3.5 text-solarized-green" />
								{item}
							</li>
						))}
					</ul>
				</div>

				<div className="mx-auto mt-12 w-full max-w-5xl overflow-hidden rounded-xl border bg-card shadow-2xl shadow-solarized-base03/10">
					<div className="flex h-11 items-center gap-3 border-b bg-muted/40 px-4">
						<div aria-hidden="true" className="flex gap-1.5">
							<span className="size-2.5 rounded-full bg-solarized-red/70" />
							<span className="size-2.5 rounded-full bg-solarized-yellow/70" />
							<span className="size-2.5 rounded-full bg-solarized-green/70" />
						</div>
						<span className="min-w-0 flex-1 truncate text-left font-mono text-muted-foreground text-xs">
							{content.demo.filename}
						</span>
					</div>

					<div className="grid lg:grid-cols-2">
						<div className="min-w-0 border-b bg-foreground p-5 text-background lg:border-r lg:border-b-0 sm:p-7">
							<p className="mb-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] opacity-55">
								{content.demo.sourceLabel}
							</p>
							<pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 sm:text-base">
								<code>{content.demo.source}</code>
							</pre>
						</div>

						<article className="min-w-0 p-5 text-left sm:p-7">
							<p className="mb-4 font-mono text-[0.68rem] text-muted-foreground uppercase tracking-[0.14em]">
								{content.demo.outputLabel}
							</p>
							<div className="mb-4 flex flex-wrap items-center gap-3">
								<span className="rounded-md bg-solarized-orange/10 px-2.5 py-1 font-mono font-semibold text-solarized-orange text-xs">
									{content.demo.diagnosisCode}
								</span>
								<h2 className="font-semibold text-lg sm:text-xl">{content.demo.diagnosis}</h2>
							</div>
							<p className="whitespace-pre-line font-sans text-base leading-7 sm:text-lg sm:leading-8">
								{content.demo.output}
							</p>
						</article>
					</div>
				</div>

				<a
					className="mx-auto mt-auto flex items-center gap-2 pt-8 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground motion-safe:animate-pulse"
					href="#markdown"
					onClick={handleFeatureScroll}
				>
					{content.scrollHint}
					<ArrowDown className="size-3.5" />
				</a>
			</div>
		</section>
	);
};
