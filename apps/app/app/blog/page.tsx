import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import Footer from "@/app/_components/landing/footer";

import { blogPosts } from "./_lib/posts";

export const metadata: Metadata = {
	description:
		"Artikel über MDScribe, medizinische Dokumentation und produktive KI-Unterstützung im klinischen Alltag.",
	title: "Blog | MDScribe",
};

export default function BlogIndexPage() {
	const [featuredPost] = blogPosts;

	return (
		<div className="h-full w-full overflow-x-hidden">
			<main className="mx-auto w-full max-w-6xl px-5 py-8 pb-24 sm:px-6 md:px-8 md:py-14">
				<header className="max-w-4xl space-y-2">
					<p className="font-medium text-muted-foreground text-sm">Blog</p>
					<h1 className="text-balance font-bold text-4xl text-solarized-blue tracking-tight md:text-6xl">
						Gedanken zu medizinischer Dokumentation
					</h1>
				</header>

				<Separator className="my-10" />

				<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{blogPosts.map((post) => (
						<Link
							className="group flex min-h-72 flex-col justify-between rounded-md border bg-background p-5 transition-colors hover:border-foreground/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={`/blog/${post.id}`}
							key={post.id}
						>
							<div className="space-y-5">
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
									<span>{post.publishedDate}</span>
								</div>
								<div className="space-y-3">
									<h2 className="text-balance font-semibold text-2xl tracking-tight">
										{post.title}
									</h2>
									<p className="text-muted-foreground leading-7">{post.description}</p>
								</div>
							</div>
							<div className="mt-8 flex items-center gap-2 font-medium text-sm">
								Lesen
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</div>
						</Link>
					))}
				</section>

				{featuredPost && (
					<section className="mt-12 rounded-md border bg-muted/20 p-5 md:p-7">
						<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
							<div className="space-y-2">
								<p className="font-medium text-sm">Zum Start</p>
								<h2 className="font-semibold text-2xl tracking-tight">{featuredPost.title}</h2>
								<p className="max-w-2xl text-muted-foreground leading-7">
									{featuredPost.description}
								</p>
							</div>
							<Button render={<Link href={`/blog/${featuredPost.id}`}>
									<ArrowRight className="h-4 w-4" />
									Artikel öffnen
								</Link>} />
						</div>
					</section>
				)}
			</main>
			<Footer />
		</div>
	);
}
