import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FileSearch, FileText, Search, Sparkles } from "lucide-react";
import Link from "next/link";

import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
	const params = await searchParams;
	const query = typeof params.query === "string" ? params.query.trim().slice(0, 200) : "";
	const queryClient = new QueryClient();
	const results = query
		? await queryClient.fetchQuery(orpc.templates.search.queryOptions({ input: { query } }))
		: [];

	return (
		<div className="relative flex h-full w-full flex-col overflow-x-hidden overflow-y-auto rounded-xl border bg-background">
			<div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
				<div className="-top-32 absolute left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
				<div className="absolute top-24 -right-24 size-72 rounded-full bg-secondary/35 blur-3xl" />
			</div>

			<div className="relative flex h-10 shrink-0 items-center md:h-0">
				<SidebarTrigger className="ml-2 block md:hidden" />
			</div>

			<section className="relative mx-auto flex w-full max-w-6xl flex-col px-4 py-10 sm:px-6 md:py-16 lg:px-8">
				<header className="mx-auto flex max-w-3xl flex-col items-center text-center">
					<Badge
						className="mb-5 gap-1.5 border-primary/20 bg-primary/10 px-3 py-1 text-primary"
						variant="outline"
					>
						<Sparkles className="size-3.5" />
						{USER_MESSAGES.templateSearch.badge}
					</Badge>
					<h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl md:text-5xl">
						{USER_MESSAGES.templateSearch.title}
					</h1>
					<p className="mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
						{USER_MESSAGES.templateSearch.description}
					</p>
				</header>

				<div className="relative mx-auto mt-9 w-full max-w-4xl">
					<div className="-inset-1 absolute rounded-3xl bg-primary/10 blur-lg" />
					<div className="relative rounded-2xl border bg-card/95 p-3 shadow-lg shadow-foreground/5 backdrop-blur-sm sm:p-4">
						<form action="/templates" className="flex flex-col gap-3 sm:flex-row" method="get">
							<div className="relative grow">
								<label className="sr-only" htmlFor="template-search">
									{USER_MESSAGES.templateSearch.label}
								</label>
								<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-5 text-muted-foreground" />
								<Input
									className="h-12 rounded-xl border-transparent bg-muted/70 pr-4 pl-12 text-base shadow-none focus-visible:border-ring sm:h-14 sm:text-lg"
									defaultValue={query}
									id="template-search"
									maxLength={200}
									name="query"
									placeholder={USER_MESSAGES.templateSearch.placeholder}
									required
									type="search"
								/>
							</div>
							<Button className="h-12 rounded-xl px-6 text-base sm:h-14" size="lg" type="submit">
								<Search className="size-4" />
								{USER_MESSAGES.templateSearch.searchAction}
							</Button>
						</form>

						<div className="mt-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-muted-foreground text-xs">
									{USER_MESSAGES.templateSearch.quickSearchLabel}
								</span>
								{USER_MESSAGES.templateSearch.quickSearches.map((quickSearch) => (
									<Link
										className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										href={`/templates?query=${encodeURIComponent(quickSearch.query)}`}
										key={quickSearch.query}
									>
										{quickSearch.label}
									</Link>
								))}
							</div>
							<div className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
								<FileSearch className="size-3.5" />
								{USER_MESSAGES.templateSearch.searchScope}
							</div>
						</div>
					</div>
				</div>

				{query && (
					<section className="mt-12 border-t pt-8 md:mt-16 md:pt-10" aria-live="polite">
						<div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="font-medium text-primary text-sm">
									{results.length} {USER_MESSAGES.templateSearch.results}
								</p>
								<h2 className="mt-1 font-semibold text-2xl tracking-tight">
									{USER_MESSAGES.templateSearch.resultsFor} „{query}“
								</h2>
							</div>
						</div>

						{results.length ? (
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{results.map((result) => (
									<Link
										className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										href={`/templates/${result.id}`}
										key={result.id}
									>
										<Card className="h-full overflow-hidden rounded-xl transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
											<CardHeader className="h-full p-5">
												<div className="mb-5 flex items-start justify-between">
													<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
														<FileText className="size-5" />
													</div>
													<ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
												</div>
												<CardDescription className="mb-2 font-medium text-primary">
													{result.category}
												</CardDescription>
												<CardTitle className="text-pretty text-lg leading-snug">
													{result.title}
												</CardTitle>
											</CardHeader>
										</Card>
									</Link>
								))}
							</div>
						) : (
							<div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-6 text-center">
								<div className="mb-4 flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs">
									<FileSearch className="size-5" />
								</div>
								<h3 className="font-semibold text-lg">{USER_MESSAGES.templateSearch.emptyTitle}</h3>
								<p className="mt-2 max-w-md text-muted-foreground text-sm">
									{USER_MESSAGES.templateSearch.emptyDescription}
								</p>
							</div>
						)}
					</section>
				)}
			</section>
		</div>
	);
}
