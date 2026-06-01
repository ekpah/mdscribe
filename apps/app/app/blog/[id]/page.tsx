import { Separator } from "@repo/design-system/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/app/_components/landing/footer";
import { blogPosts, getBlogPost } from "../_lib/posts";

interface BlogPostPageProperties {
	readonly params: Promise<{
		readonly id: string;
	}>;
}

export const generateStaticParams = () =>
	blogPosts.map((post) => ({
		id: post.id,
	}));

export const generateMetadata = async ({
	params,
}: BlogPostPageProperties): Promise<Metadata> => {
	const { id } = await params;
	const post = getBlogPost(id);

	if (!post) {
		return {
			title: "Artikel nicht gefunden | MDScribe",
		};
	}

	return {
		description: post.description,
		title: `${post.title} | MDScribe`,
	};
};

export default async function BlogPostPage({
	params,
}: BlogPostPageProperties) {
	const { id } = await params;
	const post = getBlogPost(id);

	if (!post) {
		notFound();
	}

	return (
		<div className="h-full w-full overflow-x-hidden">
			<main className="mx-auto w-full max-w-3xl px-6 py-10 pb-24 md:px-8 md:py-16">
				<Link
					className="mb-8 inline-flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground"
					href="/blog"
				>
					<ArrowLeft className="h-4 w-4" />
					Alle Artikel
				</Link>

				<article className="space-y-10">
					<header className="space-y-5">
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-muted-foreground text-sm">
								<span>{post.publishedDate}</span>
							</div>
							<h1 className="text-balance font-bold text-4xl tracking-tight md:text-5xl">
								{post.title}
							</h1>
						</div>
						<p className="text-lg text-muted-foreground leading-8">
							MDScribe ist ein Werkzeug für medizinische Dokumentation. Es soll
							Ärztinnen und Ärzte dabei unterstützen, aus Notizen, Befunden und
							Textbausteinen schneller brauchbare Arztbriefe, Verlaufsnotizen und
							andere medizinische Texte zu erstellen.
						</p>
					</header>

					<Separator />

					{post.content}
				</article>
			</main>
			<Footer />
		</div>
	);
}
