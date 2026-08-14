"use client";

import { buttonVariants } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowUpRight, Check, Github, Plus, Server } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { USER_MESSAGES } from "@/lib/user-messages";

const CONTENT = USER_MESSAGES.landing;

interface PricingProps {
	isLoggedIn: boolean;
}

interface PlanCardProps {
	caption: string;
	ctaHref: string;
	ctaLabel: string;
	description: string;
	features: readonly string[];
	icon?: ReactNode;
	isExternal?: boolean;
	isHighlighted?: boolean;
	name: string;
	price: string;
	priceSuffix?: string;
}

const PlanCard = ({
	caption,
	ctaHref,
	ctaLabel,
	description,
	features,
	icon,
	isExternal = false,
	isHighlighted = false,
	name,
	price,
	priceSuffix,
}: PlanCardProps) => (
	<article
		className={`flex min-h-full flex-col rounded-xl border bg-card p-6 ${
			isHighlighted ? "border-solarized-blue shadow-xl shadow-solarized-blue/10" : "shadow-sm"
		}`}
	>
		<div className="mb-8 flex items-start justify-between gap-4">
			<div>
				<h3 className="font-semibold text-2xl tracking-tight">{name}</h3>
				<p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
			</div>
			{icon && (
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-solarized-blue">
					{icon}
				</div>
			)}
		</div>

		<div className="mb-8">
			<div className="flex flex-wrap items-end gap-2">
				<span className="font-bold text-4xl tracking-[-0.04em]">{price}</span>
				{priceSuffix && <span className="pb-1 text-muted-foreground text-sm">{priceSuffix}</span>}
			</div>
			<p className="mt-2 font-mono text-muted-foreground text-xs">{caption}</p>
		</div>

		<ul className="mb-8 space-y-3 text-sm">
			{features.map((feature) => (
				<li className="flex gap-2.5 leading-relaxed" key={feature}>
					<Check className="mt-0.5 size-4 shrink-0 text-solarized-green" />
					<span>{feature}</span>
				</li>
			))}
		</ul>

		<Link
			className={cn(
				buttonVariants({ variant: isHighlighted ? "default" : "outline" }),
				"mt-auto h-10 w-full",
			)}
			href={ctaHref}
			rel={isExternal ? "noopener noreferrer" : undefined}
			target={isExternal ? "_blank" : undefined}
		>
			{ctaLabel}
			{isExternal && <ArrowUpRight data-icon="inline-end" />}
		</Link>
	</article>
);

const SourceSection = () => {
	const content = CONTENT.source;

	return (
		<section className="relative overflow-hidden border-b bg-foreground px-5 py-24 text-background sm:px-8 lg:px-10 lg:py-32">
			<div
				aria-hidden="true"
				className="absolute inset-0 opacity-10 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:28px_28px]"
			/>
			<div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1fr_0.9fr] lg:gap-20">
				<div>
					<p className="font-mono text-solarized-orange text-xs tracking-[0.14em]">
						{content.eyebrow}
					</p>
					<h2 className="mt-4 max-w-3xl text-balance font-bold text-4xl leading-tight tracking-[-0.04em] sm:text-5xl lg:text-6xl">
						{content.title}
					</h2>
					<p className="mt-6 max-w-2xl font-sans text-lg leading-relaxed opacity-70 sm:text-xl">
						{content.description}
					</p>

					<ul className="mt-8 grid gap-3 sm:grid-cols-2">
						{content.benefits.map((benefit) => (
							<li className="flex items-center gap-2 text-sm" key={benefit}>
								<Check className="size-4 shrink-0 text-background" />
								{benefit}
							</li>
						))}
					</ul>

					<Link
						className={cn(
							buttonVariants({ variant: "outline" }),
							"mt-9 border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background",
						)}
						href="https://github.com/ekpah/mdscribe"
						rel="noopener noreferrer"
						target="_blank"
					>
						<Github data-icon="inline-start" />
						{content.cta}
						<ArrowUpRight data-icon="inline-end" />
					</Link>
				</div>

				<div
					className="overflow-hidden rounded-xl border border-background/20 bg-solarized-base03 shadow-2xl"
					data-source-terminal
				>
					<div
						className="flex h-11 items-center gap-2 border-background/20 border-b bg-solarized-base02 px-4"
						data-source-terminal-bar
					>
						<span className="size-2.5 rounded-full bg-solarized-red" />
						<span className="size-2.5 rounded-full bg-solarized-yellow" />
						<span className="size-2.5 rounded-full bg-solarized-green" />
						<span className="ml-2 font-mono text-xs opacity-50">mdscribe</span>
					</div>
					<div
						className="space-y-4 overflow-x-auto bg-solarized-base03 p-5 font-mono text-sm sm:p-7"
						data-source-terminal-body
					>
						<p className="whitespace-nowrap">
							<span className="mr-3 text-solarized-green">$</span>
							{content.terminal.command}
						</p>
						<p className="opacity-60">{content.terminal.license}</p>
						<p className="opacity-60">{content.terminal.models}</p>
						<p className="flex items-center gap-2 text-solarized-green">
							<span className="size-2 rounded-full bg-current motion-safe:animate-pulse" />
							{content.terminal.status}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
};

export const Pricing = ({ isLoggedIn }: PricingProps) => {
	const [isYearly, setIsYearly] = useState(false);
	const content = CONTENT.pricing;
	const { free, plus, selfHosted } = content.plans;

	const handleSetMonthly = useCallback(() => {
		setIsYearly(false);
	}, []);

	const handleSetYearly = useCallback(() => {
		setIsYearly(true);
	}, []);

	return (
		<>
			<SourceSection />
			<section className="bg-muted/20 px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
				<div className="mx-auto w-full max-w-7xl">
					<div className="mx-auto max-w-3xl text-center">
						<p className="font-mono text-solarized-orange text-xs tracking-[0.14em]">
							{content.eyebrow}
						</p>
						<h2 className="mt-4 text-balance font-bold text-4xl leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">
							{content.title}
						</h2>
						<p className="mt-5 font-sans text-lg text-muted-foreground leading-relaxed sm:text-xl">
							{content.description}
						</p>
					</div>

					<div className="mt-9 flex justify-center">
						<div className="inline-flex rounded-lg border bg-background p-1 shadow-sm">
							<button
								aria-pressed={!isYearly}
								className={`rounded-md px-4 py-2 font-medium text-sm transition-colors ${
									isYearly
										? "text-muted-foreground hover:text-foreground"
										: "bg-primary text-primary-foreground"
								}`}
								onClick={handleSetMonthly}
								type="button"
							>
								{content.monthly}
							</button>
							<button
								aria-pressed={isYearly}
								className={`rounded-md px-4 py-2 font-medium text-sm transition-colors ${
									isYearly
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:text-foreground"
								}`}
								onClick={handleSetYearly}
								type="button"
							>
								{content.yearly}
								<span className="ml-1.5 text-xs opacity-75">{content.yearlyDiscount}</span>
							</button>
						</div>
					</div>

					<div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
						<PlanCard
							caption={free.caption}
							ctaHref={isLoggedIn ? "/dashboard" : "/sign-up"}
							ctaLabel={free.cta}
							description={free.description}
							features={free.features}
							name={free.name}
							price={free.price}
						/>
						<PlanCard
							caption={isYearly ? plus.captionYearly : plus.captionMonthly}
							ctaHref={isLoggedIn ? "/profile/account" : "/sign-up"}
							ctaLabel={plus.cta}
							description={plus.description}
							features={plus.features}
							icon={<Plus className="size-5" />}
							isHighlighted
							name={plus.name}
							price={isYearly ? plus.priceYearly : plus.priceMonthly}
							priceSuffix={content.perMonth}
						/>
						<PlanCard
							caption={selfHosted.caption}
							ctaHref="https://github.com/ekpah/mdscribe"
							ctaLabel={selfHosted.cta}
							description={selfHosted.description}
							features={selfHosted.features}
							icon={<Server className="size-5" />}
							isExternal
							name={selfHosted.name}
							price={selfHosted.price}
						/>
					</div>
				</div>
			</section>
		</>
	);
};
