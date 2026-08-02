"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Check, Code, Github, Server, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import type { PricingFeature } from "./pricing-content";
import { pricingContent } from "./pricing-content";

interface PricingProps {
	isLoggedIn: boolean;
}

const featureIcons = {
	check: Check,
	code: Code,
	server: Server,
	shield: Shield,
};

const FeatureList = ({
	features,
	iconClassName,
}: {
	features: readonly PricingFeature[];
	iconClassName: string;
}) => (
	<ul className="mb-6 space-y-3">
		{features.map((feature) => {
			const Icon = featureIcons[feature.icon];

			return (
				<li className="flex items-center" key={feature.label}>
					<Icon className={`mr-3 h-5 w-5 ${iconClassName}`} />
					<span className={"emphasized" in feature ? "font-medium" : undefined}>
						{feature.label}
					</span>
				</li>
			);
		})}
	</ul>
);

// PERF: Accept isLoggedIn from server instead of using useSession()
export default function Pricing({ isLoggedIn }: PricingProps) {
	const [isYearly, setIsYearly] = useState(false);
	const { billing, plans } = pricingContent;
	const pathname = usePathname();
	const signInUrl = `/sign-in?redirect=${encodeURIComponent(pathname)}`;
	const handleSetMonthly = useCallback(() => {
		setIsYearly(false);
	}, []);
	const handleSetYearly = useCallback(() => {
		setIsYearly(true);
	}, []);

	return (
		<section className="bg-muted/30 py-12 sm:py-16">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="text-center">
					<h1 className="my-2 w-full font-bold text-4xl leading-tight sm:text-5xl">
						{pricingContent.heading}
					</h1>
					<div className="mb-4 w-full">
						<div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
					</div>
					<p className="mb-12 text-lg text-muted-foreground sm:text-xl">
						{pricingContent.description}
					</p>
				</div>

				<div className="mb-10 flex justify-center">
					<div className="inline-flex items-center rounded-full border p-1">
						<button
							className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${
								isYearly ? "bg-transparent hover:bg-muted" : "bg-primary text-primary-foreground"
							}`}
							onClick={handleSetMonthly}
							type="button"
						>
							{billing.monthly}
						</button>
						<button
							className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${
								isYearly ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
							}`}
							onClick={handleSetYearly}
							type="button"
						>
							{billing.yearly} <span className="text-xs opacity-75">{billing.yearlyDiscount}</span>
						</button>
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{/* Free Plan */}
					<div className="flex flex-col rounded-lg border-2 border-solarized-green/50 bg-card p-6 shadow-lg">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">{plans.free.name}</h3>
							<p className="text-muted-foreground">{plans.free.description}</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<span className="font-bold text-3xl text-solarized-green">{plans.free.price}</span>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">{plans.free.priceDetail}</p>
						</div>
						<FeatureList features={plans.free.features} iconClassName="text-solarized-green" />
						<Button
							className="mt-auto bg-solarized-green hover:bg-solarized-green/90"
							render={<Link href={isLoggedIn ? "/dashboard" : "/sign-up"}>{plans.free.cta}</Link>}
						/>
					</div>

					{/* Plus Plan */}
					<div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">{plans.plus.name}</h3>
							<p className="text-muted-foreground">{plans.plus.description}</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<span className="font-bold text-4xl">
									€{isYearly ? plans.plus.yearlyPrice : plans.plus.monthlyPrice}
								</span>
								<span className="text-muted-foreground">{plans.plus.priceUnit}</span>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								{isYearly ? plans.plus.yearlyPriceDetail : plans.plus.monthlyPriceDetail}
							</p>
						</div>
						<FeatureList features={plans.plus.features} iconClassName="text-primary" />
						<Button
							className="mt-auto"
							variant="outline"
							render={
								<Link href={isLoggedIn ? "/profile/account" : signInUrl}>{plans.plus.cta}</Link>
							}
						/>
					</div>

					{/* Self-Hosting Plan */}
					<div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">{plans.selfHosted.name}</h3>
							<p className="text-muted-foreground">{plans.selfHosted.description}</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<span className="font-bold text-3xl">{plans.selfHosted.price}</span>
							</div>
						</div>
						<FeatureList features={plans.selfHosted.features} iconClassName="text-primary" />
						<Button
							className="mt-auto"
							variant="outline"
							render={
								<Link
									className="flex items-center justify-center gap-2"
									href="https://github.com/ekpah/mdscribe"
									rel="noopener noreferrer"
									target="_blank"
								>
									<Github className="h-5 w-5" />
									<span>{plans.selfHosted.cta}</span>
								</Link>
							}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
