import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Check, Code, Github, Server, Shield } from "lucide-react";
import Link from "next/link";

import { pricingContent } from "../pricing-content";

const featureIcons = {
	check: Check,
	code: Code,
	server: Server,
	shield: Shield,
};

export default function PricingSkeleton() {
	const { billing, plans } = pricingContent;

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
							className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-primary text-primary-foreground"
							disabled
							type="button"
						>
							{billing.monthly}
						</button>
						<button
							className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-transparent hover:bg-muted"
							disabled
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
						<ul className="mb-6 space-y-3">
							{plans.free.features.map((feature) => (
								<li className="flex items-center" key={feature.label}>
									<Check className="mr-3 h-5 w-5 text-solarized-green" />
									<span>{feature.label}</span>
								</li>
							))}
						</ul>
						<Button
							className="mt-auto bg-solarized-green hover:bg-solarized-green/90"
							render={<Link href="/sign-up">{plans.free.cta}</Link>}
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
								<Skeleton className="inline-block h-10 w-16" />
								<span className="text-muted-foreground">{plans.plus.priceUnit}</span>
							</div>
							<Skeleton className="mt-1 h-5 w-28" />
						</div>
						<ul className="mb-6 space-y-3">
							{plans.plus.features.map((feature) => {
								const Icon = featureIcons[feature.icon];

								return (
									<li className="flex items-center" key={feature.label}>
										<Icon className="mr-3 h-5 w-5 text-primary" />
										<span className={"emphasized" in feature ? "font-medium" : undefined}>
											{feature.label}
										</span>
									</li>
								);
							})}
						</ul>
						<Skeleton className="mt-auto h-11 w-full" />
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
						<ul className="mb-6 space-y-3">
							{plans.selfHosted.features.map((feature) => {
								const Icon = featureIcons[feature.icon];

								return (
									<li className="flex items-center" key={feature.label}>
										<Icon className="mr-3 h-5 w-5 text-primary" />
										<span className={"emphasized" in feature ? "font-medium" : undefined}>
											{feature.label}
										</span>
									</li>
								);
							})}
						</ul>
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
