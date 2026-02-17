import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Check, Code, Server } from "lucide-react";
import Link from "next/link";

export default function PricingSkeleton() {
	return (
		<section className="bg-muted/30 py-12 sm:py-16">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="text-center">
					<h1 className="my-2 w-full font-bold text-4xl leading-tight sm:text-5xl">
						Starte kostenlos mit KI
					</h1>
					<div className="mb-4 w-full">
						<div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
					</div>
					<p className="mb-12 text-lg text-muted-foreground sm:text-xl">
						Nutze MDScribe so, wie es für dich am besten passt – wir wollen
						gute und sichere Software für Mediziner einfach zur Verfügung
						stellen.
					</p>
				</div>

				<div className="mb-10 flex justify-center">
					<div className="inline-flex items-center rounded-full border p-1">
						<button
							className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-primary text-primary-foreground"
							disabled
							type="button"
						>
							Monatlich
						</button>
						<button
							className="rounded-full px-4 py-2 font-medium text-sm transition-all bg-transparent hover:bg-muted"
							disabled
							type="button"
						>
							Jährlich <span className="text-xs opacity-75">(-17%)</span>
						</button>
					</div>
				</div>

				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{/* Free Plan */}
					<div className="flex flex-col rounded-lg border-2 border-solarized-green/50 bg-card p-6 shadow-lg">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">MDScribe Free</h3>
							<p className="text-muted-foreground">Perfekt für den Einstieg</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<span className="font-bold text-3xl text-solarized-green">
									Kostenlos
								</span>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								Für immer kostenlos
							</p>
						</div>
						<ul className="mb-6 space-y-3">
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-solarized-green" />
								<span>50 KI-Requests/Monat</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-solarized-green" />
								<span>Eigene Templates erstellen</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-solarized-green" />
								<span>Basis-Textbausteine</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-solarized-green" />
								<span>Community Support</span>
							</li>
						</ul>
						<Button
							asChild
							className="mt-auto bg-solarized-green hover:bg-solarized-green/90"
						>
							<Link href="/sign-up">Kostenlos starten</Link>
						</Button>
					</div>

					{/* Plus Plan */}
					<div className="relative flex flex-col rounded-lg border bg-card p-6 shadow-sm">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">MDScribe Plus</h3>
							<p className="text-muted-foreground">Für den klinischen Alltag</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<Skeleton className="inline-block h-10 w-16" />
								<span className="text-muted-foreground">/Monat</span>
							</div>
							<Skeleton className="mt-1 h-5 w-28" />
						</div>
						<ul className="mb-6 space-y-3">
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span className="font-medium">Alle kostenlosen Features</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>Alle Templates & Textbausteine</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>500 KI-Requests/Monat</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>Vollständige KI-Unterstützung</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>Priorisierter E-Mail Support</span>
							</li>
							<li className="flex items-center">
								<Skeleton className="mr-3 h-5 w-5 rounded-full" />
								<Skeleton className="h-5 w-48" />
							</li>
						</ul>
						<Skeleton className="mt-auto h-11 w-full" />
					</div>

					{/* Self-Hosting Plan */}
					<div className="flex flex-col rounded-lg border bg-card p-6 shadow-sm">
						<div className="mb-4 min-h-[4.5rem]">
							<h3 className="mb-2 font-bold text-2xl">Self-Hosting</h3>
							<p className="text-muted-foreground">
								Volle Kontrolle, eigene Infrastruktur
							</p>
						</div>
						<div className="mb-4 min-h-[5rem]">
							<div>
								<span className="font-bold text-3xl">Kostenlos</span>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">
								Open Source (AGPL-3.0)
							</p>
						</div>
						<ul className="mb-6 space-y-3">
							<li className="flex items-center">
								<Code className="mr-3 h-5 w-5 text-primary" />
								<span className="font-medium">Open Source (AGPL-3.0)</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>Eigene API-Keys</span>
							</li>
							<li className="flex items-center">
								<Server className="mr-3 h-5 w-5 text-primary" />
								<span>Volle Datenkontrolle</span>
							</li>
							<li className="flex items-center">
								<Check className="mr-3 h-5 w-5 text-primary" />
								<span>Community Support</span>
							</li>
						</ul>
						<Button asChild className="mt-auto" variant="outline">
							<Link href="/docs/self-hosting">Zur Dokumentation</Link>
						</Button>
					</div>
				</div>

				{/* Bottom CTA */}
				<div className="mt-16 text-center">
					<h3 className="mb-4 font-bold text-2xl">Bereit anzufangen?</h3>
					<p className="mb-6 text-lg text-muted-foreground">
						Starte kostenlos und upgrade nur, wenn du mehr brauchst.
					</p>
					<Button asChild className="px-8 py-6 font-semibold text-lg" size="lg">
						<Link href="/sign-up">Jetzt kostenlos registrieren</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
