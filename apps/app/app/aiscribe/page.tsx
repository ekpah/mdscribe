import { Alert, AlertDescription } from "@repo/design-system/components/ui/alert";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	AlertCircle,
	ArrowRight,
	Blocks,
	FileText,
	PenTool,
	Search,
	UserPlus,
	Zap,
} from "lucide-react";
import Link from "next/link";

import { getTemplateSections } from "@/features/template-tags/sections";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import { getServerSession } from "@/lib/server-session";

interface ScribeCardProps {
	title: string;
	description?: string;
	href: string;
	icon: React.ReactNode;
	isLoggedIn: boolean;
	topRightIcon?: React.ReactNode;
}

const ScribeCard = ({
	title,
	description,
	href,
	icon,
	isLoggedIn,
	topRightIcon,
}: ScribeCardProps) => {
	if (!isLoggedIn) {
		return (
			<div className="block cursor-not-allowed">
				<Card className="h-full border-solarized-base2 opacity-50">
					<CardHeader className="p-4 sm:p-5">
						<div className="flex items-center justify-between">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-solarized-base2 sm:h-9 sm:w-9">
								{icon}
							</div>
							{topRightIcon}
						</div>
						<CardTitle className="mt-3 text-sm text-solarized-base00 sm:text-base">
							{title}
						</CardTitle>
						<CardDescription className="line-clamp-2 text-xs text-solarized-base01 sm:text-sm">
							{description}
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<Link href={href} className="group block h-full">
			<Card className="h-full border-solarized-base2 transition-all duration-200 hover:shadow-md hover:border-solarized-blue">
				<CardHeader className="p-4 sm:p-5">
					<div className="flex items-center justify-between">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9 bg-solarized-blue/10 group-hover:bg-solarized-blue/20">
							{icon}
						</div>
						<div className="flex items-center gap-2">
							<ArrowRight className="h-4 w-4 text-solarized-base01 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
							{topRightIcon}
						</div>
					</div>
					<CardTitle className="mt-3 text-sm text-solarized-base00 sm:text-base group-hover:text-solarized-blue">
						{title}
					</CardTitle>
					<CardDescription className="line-clamp-2 text-xs text-solarized-base01 sm:text-sm">
						{description}
					</CardDescription>
				</CardHeader>
			</Card>
		</Link>
	);
};

const SectionsMarker = () => (
	<span className="text-solarized-cyan" title="Brief mit mehreren Abschnitten">
		<Blocks aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
		<span className="sr-only">Brief mit mehreren Abschnitten</span>
	</span>
);

export default async function AIScribeLandingPage() {
	const queryClient = getQueryClient();
	const session = await getServerSession();
	const isLoggedIn = !!session?.user;
	const templates = await queryClient.fetchQuery(orpc.templates.aiScribeDefaults.queryOptions());

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-solarized-base3">
			<div className="flex-1 overflow-y-auto p-4 pb-16 sm:p-6 sm:pb-20">
				<div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
					{/* Header Section */}
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
								<PenTool className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
							</div>
							<div>
								<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">AI Scribe</h1>
								<p className="text-sm text-solarized-base01 sm:text-base">
									Intelligente medizinische Dokumentation
								</p>
							</div>
						</div>
					</div>

					{/* Login Alerts */}
					{!isLoggedIn && (
						<div className="space-y-3">
							<Alert className="border-solarized-base2 bg-solarized-base2/50">
								<UserPlus className="h-4 w-4 text-solarized-blue" />
								<AlertDescription className="text-solarized-base01">
									Neu hier?{" "}
									<Link
										className="font-medium text-solarized-blue underline hover:text-solarized-cyan"
										href="/sign-up"
									>
										Registriere dich kostenlos
									</Link>{" "}
									um Zugang zu allen AI Scribe Funktionen zu erhalten!
								</AlertDescription>
							</Alert>

							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									Du musst dich{" "}
									<Link className="font-medium underline" href="/sign-in?redirect=%2Faiscribe">
										einloggen
									</Link>{" "}
									um diese Funktion nutzen zu können
								</AlertDescription>
							</Alert>
						</div>
					)}

					{/* Quick Generation Section */}
					<div className="space-y-3 sm:space-y-4">
						<div className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-solarized-violet" />
							<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
								Schnelle Dokument-Generierung
							</h2>
						</div>
						<p className="text-xs text-solarized-base01 sm:text-sm">
							Jede Textvorlage lässt sich mit AI Scribe generieren. Vorlagen mit mehreren
							Abschnitten öffnen sich als Brief-Editor.
						</p>
						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
							{templates.map((template) => (
								<ScribeCard
									href={`/aiscribe/${template.id}`}
									icon={<FileText className="h-4 w-4 text-solarized-blue sm:h-5 sm:w-5" />}
									isLoggedIn={isLoggedIn}
									key={template.id}
									title={template.title}
									topRightIcon={
										getTemplateSections(template.content).length > 0 ? <SectionsMarker /> : null
									}
								/>
							))}
							<ScribeCard
								description="Eine beliebige eigene oder öffentliche Textvorlage auswählen."
								href="/templates"
								icon={<Search className="h-4 w-4 text-solarized-base01 sm:h-5 sm:w-5" />}
								isLoggedIn={isLoggedIn}
								title="Andere Vorlage"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
