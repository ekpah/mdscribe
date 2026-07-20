import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { QueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
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
		<div className="flex h-full w-full flex-col overflow-y-auto">
			<div className="flex h-10 shrink-0 items-center">
				<SidebarTrigger className="ml-2 block md:hidden" />
			</div>
			<section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 md:py-20">
				<header className="space-y-3 text-center">
					<h1 className="font-semibold text-3xl md:text-5xl">
						{USER_MESSAGES.templateSearch.title}
					</h1>
					<p className="text-lg text-muted-foreground">
						{USER_MESSAGES.templateSearch.description}
					</p>
				</header>
				<form action="/templates" className="relative" method="get">
					<label className="sr-only" htmlFor="template-search">
						{USER_MESSAGES.templateSearch.label}
					</label>
					<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-5 size-6 text-muted-foreground" />
					<Input
						className="h-16 rounded-xl pr-5 pl-14 text-lg shadow-md md:h-20 md:text-xl"
						defaultValue={query}
						id="template-search"
						maxLength={200}
						name="query"
						placeholder={USER_MESSAGES.templateSearch.placeholder}
						required
						type="search"
					/>
				</form>
				{query && (
					<section className="space-y-4">
						<h2 className="font-semibold text-xl">{USER_MESSAGES.templateSearch.results}</h2>
						{results.length ? (
							<div className="grid gap-4 sm:grid-cols-2">
								{results.map((result) => (
									<Link href={`/templates/${result.id}`} key={result.id}>
										<Card className="h-full transition-colors hover:bg-muted/50">
											<CardHeader>
												<CardTitle>{result.title}</CardTitle>
												<CardDescription>{result.category}</CardDescription>
											</CardHeader>
										</Card>
									</Link>
								))}
							</div>
						) : (
							<p className="text-muted-foreground">{USER_MESSAGES.templateSearch.empty}</p>
						)}
					</section>
				)}
			</section>
		</div>
	);
}
