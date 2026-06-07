import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { env } from "@repo/env";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
	Activity,
	ArrowRight,
	BookmarkIcon,
	Brain,
	ClipboardCheck,
	CreditCard,
	ExternalLinkIcon,
	FileCheck,
	FileText,
	Heart,
	PlusIcon,
	SearchIcon,
	Settings,
	ShieldIcon,
	Star,
	Stethoscope,
	Zap,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import { PRODUCT_PLANS } from "@/lib/product-plans";
import { getServerSession } from "@/lib/server-session";
import { createSignInRedirect, getRequestedPath } from "@/lib/sign-in-redirect";
import type { DocumentType } from "@/orpc/scribe/types";

import { LiveTime } from "./_components/live-time";

/** Readable German labels for AI scribe document types */
const documentTypeLabels: Record<DocumentType, string> = {
	anamnese: "ER Anamnese",
	befunde: "ER Befunde",
	diagnosis: "Diagnoseblock Update",
	discharge: "Entlassungsbrief",
	"icu-transfer": "ICU Transfer",
	outpatient: "Ambulante Vorstellung",
	procedures: "Prozeduren",
};

/** Readable German labels for usage event names */
const eventNameLabels: Record<string, string> = {
	admin_scribe_playground: "Playground-Generierung",
	ai_input_fill: "Eingaben ausgefüllt",
	ai_input_fill_inputs: "Eingaben ausgefüllt",
	ai_pdf_form_parsing: "PDF-Formular analysiert",
	ai_scribe_generation: "KI-Dokumentation generiert",
};

const AI_FUNCTIONS = [
	{
		bgColor: "bg-solarized-red/10",
		borderColor: "border-solarized-red/20",
		color: "text-solarized-red",
		description: "Erstellen Sie professionelle Anamnese-Dokumentation für Notfallpatienten",
		href: "/aiscribe/er",
		icon: Heart,
		title: "Notfall Anamnese",
	},
	{
		bgColor: "bg-solarized-blue/10",
		borderColor: "border-solarized-blue/20",
		color: "text-solarized-blue",
		description: "Erstellen Sie professionelle Entlassungsbriefe für Ihre Patienten",
		href: "/aiscribe/discharge",
		icon: FileCheck,
		title: "Entlassungsbrief",
	},
	{
		bgColor: "bg-solarized-orange/10",
		borderColor: "border-solarized-orange/20",
		color: "text-solarized-orange",
		description: "Erstellen Sie professionelle Dokumentationen für medizinische Eingriffe",
		href: "/aiscribe/procedures",
		icon: ClipboardCheck,
		title: "Prozedur-Dokumentation",
	},
	{
		bgColor: "bg-solarized-green/10",
		borderColor: "border-solarized-green/20",
		color: "text-solarized-green",
		description: "Erstellen Sie professionelle Verlegungsbriefe für Ihre ICU-Patienten",
		href: "/aiscribe/icu",
		icon: Stethoscope,
		title: "ICU Verlegungsbrief",
	},
	{
		bgColor: "bg-solarized-violet/10",
		borderColor: "border-solarized-violet/20",
		color: "text-solarized-violet",
		description: "Erstellen Sie Dokumentationen für ambulante Patientenbesuche",
		href: "/aiscribe/outpatient",
		icon: FileText,
		title: "Ambulante Konsultation",
	},
	{
		bgColor: "bg-solarized-cyan/10",
		borderColor: "border-solarized-cyan/20",
		color: "text-solarized-cyan",
		description: "Erstellen Sie aktualisierte Diagnoseblöcke basierend auf bestehenden Diagnosen",
		href: "/aiscribe/diagnoseblock",
		icon: FileText,
		title: "Diagnoseblock Update",
	},
];

const getSubscriptionPlanLabel = (plan?: string | null) => {
	if (!plan) {
		return "Basis";
	}

	const normalizedPlan = plan.toLowerCase();
	return normalizedPlan === "plus"
		? "Plus"
		: normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
};

const getSubscriptionStatus = (subscription?: { status?: string; cancelAtPeriodEnd?: boolean }) => {
	if (!subscription) {
		return {
			badgeClassName: "border-solarized-base1 text-solarized-base01",
			label: "Kein Abonnement",
		};
	}

	if (subscription.cancelAtPeriodEnd) {
		return {
			badgeClassName: "border-solarized-orange/70 text-solarized-orange",
			label: "Wird gekündigt",
		};
	}

	if (subscription.status === "trialing") {
		return {
			badgeClassName: "border-solarized-blue/70 text-solarized-blue",
			label: "Testphase",
		};
	}

	return {
		badgeClassName: "border-solarized-green/70 text-solarized-green",
		label: "Aktiv",
	};
};

const getRelativeTimeLabel = (timestamp: Date | string) => {
	const now = new Date();
	const eventTime = new Date(timestamp);
	const diffMs = now.getTime() - eventTime.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	const diffHours = Math.floor(diffMs / 3_600_000);
	const diffDays = Math.floor(diffMs / 86_400_000);

	if (diffMins < 60) {
		return `${diffMins} Minuten`;
	}

	if (diffHours < 24) {
		return `${diffHours} Stunden`;
	}

	return `${diffDays} ${diffDays === 1 ? "Tag" : "Tage"}`;
};

const getActivityPresentation = (event: { metadata: unknown; name: string }) => {
	if (event.name === "ai_scribe_generation") {
		const metadata = event.metadata as Record<string, unknown> | null;
		const endpoint = metadata?.endpoint as DocumentType | undefined;
		return {
			icon: Brain,
			title:
				endpoint && documentTypeLabels[endpoint]
					? documentTypeLabels[endpoint]
					: (eventNameLabels[event.name] ?? event.name),
		};
	}

	if (event.name === "ai_input_fill" || event.name === "ai_input_fill_inputs") {
		return {
			icon: FileCheck,
			title: eventNameLabels[event.name] ?? event.name,
		};
	}

	if (event.name === "ai_pdf_form_parsing") {
		return {
			icon: FileText,
			title: eventNameLabels[event.name] ?? event.name,
		};
	}

	if (event.name.includes("template")) {
		return {
			icon: FileText,
			title: "Template verwendet",
		};
	}

	return {
		icon: Activity,
		title: eventNameLabels[event.name] ?? event.name,
	};
};

const getRecentActivityItems = (
	events: {
		id: string;
		metadata: unknown;
		name: string;
		timestamp: Date | string;
	}[],
) =>
	events.map((event) => {
		const presentation = getActivityPresentation(event);
		return {
			icon: presentation.icon,
			id: event.id,
			time: getRelativeTimeLabel(event.timestamp),
			title: presentation.title,
			type: event.name,
		};
	});

interface DashboardTemplate {
	_count: {
		favouriteOf: number;
	};
	category: string;
	content: string;
	id: string;
	title: string;
}

interface DashboardActivity {
	icon: typeof Activity;
	id: string;
	time: string;
	title: string;
	type: string;
}

const DashboardHeader = ({
	isAdmin,
	userDisplayName,
	userImage,
}: {
	isAdmin: boolean;
	userDisplayName: string;
	userImage?: string | null;
}) => (
	<div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
		<div className="flex flex-col items-start space-y-4 sm:flex-row sm:items-center sm:space-x-6 sm:space-y-0">
			<div className="relative">
				<Avatar className="h-16 w-16 shadow-lg ring-4 ring-white sm:h-20 sm:w-20">
					<AvatarImage alt={userDisplayName} src={userImage || undefined} />
					<AvatarFallback className="bg-gradient-to-br from-solarized-blue to-solarized-violet font-bold text-lg text-solarized-base3 sm:text-xl">
						{userDisplayName.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="-bottom-1 -right-1 absolute h-4 w-4 rounded-full border-2 border-white bg-green-500 sm:h-6 sm:w-6" />
			</div>
			<div>
				<h1 className="mb-2 font-bold text-2xl text-solarized-base03 sm:text-3xl lg:text-4xl">
					Willkommen zurück, {userDisplayName}!
				</h1>
				<p className="mb-1 text-base text-solarized-base01 sm:text-lg">
					Bereit für einen produktiven Tag in der medizinischen Dokumentation?
				</p>
				<div className="flex flex-col gap-2 text-solarized-base1 text-xs sm:flex-row sm:items-center sm:gap-4 sm:text-sm">
					<LiveTime />
				</div>
			</div>
		</div>
		<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
			{isAdmin ? (
				<Link href="/admin">
					<Button
						className="w-full gap-2 border-solarized-base1 text-solarized-base01 hover:bg-solarized-base2 sm:w-auto"
						size="sm"
						variant="outline"
					>
						<ShieldIcon className="h-4 w-4" />
						Admin
					</Button>
				</Link>
			) : null}
			<Link href="/profile/account">
				<Button
					className="w-full gap-2 border-solarized-base1 text-solarized-base01 hover:bg-solarized-base2 sm:w-auto"
					size="sm"
					variant="outline"
				>
					<Settings className="h-4 w-4" />
					Einstellungen
				</Button>
			</Link>
			<Link href="/aiscribe">
				<Button
					className="w-full gap-2 bg-solarized-blue text-white hover:bg-solarized-blue/90 sm:w-auto"
					size="sm"
				>
					<Zap className="h-4 w-4" />
					KI starten
				</Button>
			</Link>
		</div>
	</div>
);

const DashboardQuickStats = ({
	currentUsage,
	favoriteCount,
	monthlyUsageLimit,
	subscriptionPlanLabel,
	subscriptionStatus,
	userTemplateCount,
}: {
	currentUsage: number;
	favoriteCount: number;
	monthlyUsageLimit: number;
	subscriptionPlanLabel: string;
	subscriptionStatus: ReturnType<typeof getSubscriptionStatus>;
	userTemplateCount: number;
}) => (
	<div className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2">
		<Card className="h-full border-solarized-blue/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="font-medium text-solarized-base03 text-sm">Templates</CardTitle>
				<FileText className="h-5 w-5 text-solarized-blue" />
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="grid grid-cols-2 gap-3">
					<Link href="/templates?activeCollection=favourites">
						<div className="rounded-lg border border-solarized-blue/20 bg-solarized-blue/5 p-3 transition-colors hover:bg-solarized-blue/10">
							<div className="flex items-center gap-2 text-solarized-base01 text-xs">
								<BookmarkIcon className="h-3 w-3 text-solarized-blue" />
								Favoriten
							</div>
							<p className="mt-1 font-bold text-solarized-base03 text-xl">{favoriteCount}</p>
						</div>
					</Link>
					<Link href="/templates?activeCollection=authored">
						<div className="rounded-lg border border-solarized-green/20 bg-solarized-green/5 p-3 transition-colors hover:bg-solarized-green/10">
							<div className="flex items-center gap-2 text-solarized-base01 text-xs">
								<PlusIcon className="h-3 w-3 text-solarized-green" />
								Erstellt
							</div>
							<p className="mt-1 font-bold text-solarized-base03 text-xl">{userTemplateCount}</p>
						</div>
					</Link>
				</div>
				<Link
					className="inline-flex items-center gap-1 text-solarized-blue text-xs hover:text-solarized-blue/80"
					href="/templates"
				>
					Alle Templates anzeigen
					<ArrowRight className="h-3 w-3" />
				</Link>
			</CardContent>
		</Card>

		<Card className="h-full border-solarized-violet/30 bg-solarized-base3 shadow-lg transition-all duration-300 hover:shadow-xl">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="font-medium text-solarized-base03 text-sm">
					KI-Generierungen
				</CardTitle>
				<Brain className="h-5 w-5 text-solarized-violet" />
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="font-bold text-solarized-base03 text-xl sm:text-3xl">
					{currentUsage}
					<span className="font-normal text-sm text-solarized-base01"> / {monthlyUsageLimit}</span>
				</div>
				<p className="text-solarized-base01 text-xs">Im aktuellen Monat verwendet</p>
				<div className="space-y-2 border-solarized-base1/40 border-t pt-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="inline-flex items-center gap-1 font-medium text-solarized-base01 text-xs">
							<CreditCard className="h-3 w-3" />
							{subscriptionPlanLabel}
						</span>
						<Badge className={subscriptionStatus.badgeClassName} variant="outline">
							{subscriptionStatus.label}
						</Badge>
					</div>
					<Link
						className="inline-flex items-center gap-1 text-solarized-blue text-xs hover:text-solarized-blue/80"
						href="/subscription"
					>
						Abonnement verwalten
						<ArrowRight className="h-3 w-3" />
					</Link>
				</div>
			</CardContent>
		</Card>
	</div>
);

const AiFunctionsSection = () => (
	<Card className="border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
		<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<CardTitle className="flex items-center gap-2 font-bold text-solarized-base03 text-xl sm:text-2xl">
					<Brain className="h-5 w-5 text-solarized-violet sm:h-6 sm:w-6" />
					KI-Funktionen
				</CardTitle>
				<CardDescription className="text-solarized-base01">
					Nutzen Sie KI-gestützte Dokumentation für verschiedene medizinische Bereiche
				</CardDescription>
			</div>
			<Link href="/aiscribe">
				<Button className="w-full gap-2 border-0 bg-solarized-blue text-white hover:bg-solarized-blue/90 sm:w-auto">
					<ExternalLinkIcon className="h-4 w-4" />
					Alle Funktionen
				</Button>
			</Link>
		</CardHeader>
		<CardContent>
			<div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
				{AI_FUNCTIONS.map((func) => (
					<Link href={func.href} key={func.href}>
						<Card className="group h-full cursor-pointer border-solarized-base1 bg-solarized-base3 transition-all duration-200 hover:scale-105 hover:shadow-xl">
							<CardHeader className="pb-3">
								<div className="mb-3 flex items-center justify-between">
									<div
										className={`inline-flex rounded-lg border-2 p-3 ${func.bgColor} ${func.borderColor}`}
									>
										<func.icon className={`h-6 w-6 ${func.color}`} />
									</div>
								</div>
								<CardTitle className="text-lg text-solarized-base03 transition-colors group-hover:text-solarized-blue">
									{func.title}
								</CardTitle>
								<CardDescription className="text-sm text-solarized-base01">
									{func.description}
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-0">
								<div className="flex items-center font-medium text-sm text-solarized-blue transition-transform group-hover:translate-x-1">
									Jetzt verwenden
									<ArrowRight className="ml-1 h-4 w-4" />
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</CardContent>
	</Card>
);

const FavoriteTemplatesCard = ({ templates }: { templates: DashboardTemplate[] }) => (
	<Card className="h-full border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
		<CardHeader className="flex flex-row items-center justify-between">
			<div>
				<CardTitle className="flex items-center gap-2 font-bold text-2xl text-solarized-base03">
					<Star className="h-6 w-6 text-solarized-yellow" />
					Meine Favoriten
				</CardTitle>
				<CardDescription className="text-solarized-base01">
					Ihre am häufigsten verwendeten Templates
				</CardDescription>
			</div>
			<Link href="/templates">
				<Button className="gap-2 bg-transparent" size="sm" variant="outline">
					<ExternalLinkIcon className="h-4 w-4" />
					Alle anzeigen
				</Button>
			</Link>
		</CardHeader>
		<CardContent>
			<div className="space-y-3">
				{templates.length > 0 ? (
					templates.map((template) => (
						<Card
							className="border border-solarized-base2 transition-all duration-200 hover:shadow-md"
							key={template.id}
						>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="mb-2 flex items-center gap-2">
											<Badge className="text-xs" variant="secondary">
												{template.category}
											</Badge>
											<Badge className="text-xs" variant="outline">
												<Heart className="mr-1 h-3 w-3" />
												{template._count.favouriteOf}
											</Badge>
										</div>
										<h3 className="mb-1 font-semibold text-solarized-base03">{template.title}</h3>
										<p className="mb-2 line-clamp-2 text-sm text-solarized-base01">
											{template.content.slice(0, 100)}...
										</p>
									</div>
									<Link href={`/templates/${template.id}`}>
										<Button className="gap-1" size="sm" variant="ghost">
											<ExternalLinkIcon className="h-3 w-3" />
											Öffnen
										</Button>
									</Link>
								</div>
							</CardContent>
						</Card>
					))
				) : (
					<Card className="border-2 border-solarized-base1 border-dashed">
						<CardContent className="p-8 text-center">
							<BookmarkIcon className="mx-auto mb-4 h-12 w-12 text-solarized-base2" />
							<h3 className="mb-2 font-semibold text-solarized-base03">Noch keine Favoriten</h3>
							<p className="mb-4 text-sm text-solarized-base01">
								Markieren Sie Templates als Favoriten, um sie hier schnell zu finden.
							</p>
							<Link href="/templates">
								<Button className="gap-2">
									<SearchIcon className="h-4 w-4" />
									Templates durchsuchen
								</Button>
							</Link>
						</CardContent>
					</Card>
				)}
			</div>
		</CardContent>
	</Card>
);

const UserTemplatesCard = ({ templates }: { templates: DashboardTemplate[] }) => (
	<Card className="border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
		<CardHeader>
			<div className="flex items-center justify-between gap-4">
				<div>
					<CardTitle className="font-bold text-solarized-base03 text-xl">Meine Templates</CardTitle>
					<CardDescription className="text-solarized-base01">
						Ihre eigenen Vorlagen im schnellen Zugriff
					</CardDescription>
				</div>
				<Link href="/templates/create">
					<Button className="gap-1 bg-transparent" size="sm" variant="outline">
						<PlusIcon className="h-3 w-3" />
						Neu
					</Button>
				</Link>
			</div>
		</CardHeader>
		<CardContent>
			<div className="space-y-2">
				{templates.length > 0 ? (
					templates.map((template) => (
						<div
							className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-solarized-base2"
							key={template.id}
						>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm text-solarized-base03">
									{template.title}
								</p>
								<div className="mt-1 flex items-center gap-2">
									<Badge className="text-xs" variant="secondary">
										{template.category}
									</Badge>
									<span className="text-solarized-base1 text-xs">
										{template._count.favouriteOf} ♥
									</span>
								</div>
							</div>
							<Link href={`/templates/${template.id}`}>
								<Button className="h-8 w-8 p-0" size="sm" variant="ghost">
									<ExternalLinkIcon className="h-3 w-3" />
								</Button>
							</Link>
						</div>
					))
				) : (
					<div className="py-4 text-center">
						<PlusIcon className="mx-auto mb-2 h-8 w-8 text-solarized-base2" />
						<p className="mb-2 text-sm text-solarized-base01">Noch keine eigenen Templates</p>
						<Link href="/templates/create">
							<Button className="gap-1" size="sm">
								<PlusIcon className="h-3 w-3" />
								Erstellen
							</Button>
						</Link>
					</div>
				)}
			</div>
		</CardContent>
	</Card>
);

const RecentActivityCard = ({ activities }: { activities: DashboardActivity[] }) => (
	<Card className="border-0 bg-solarized-base3/80 shadow-xl backdrop-blur-sm">
		<CardHeader>
			<CardTitle className="flex items-center gap-2 font-bold text-solarized-base03 text-xl">
				<Activity className="h-5 w-5 text-solarized-green" />
				Letzte Aktivität
			</CardTitle>
			<CardDescription className="text-solarized-base01">
				Ihre neuesten Aktionen im Überblick
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div className="space-y-4">
				{activities.length > 0 ? (
					activities.map((activity) => (
						<div
							className="flex items-start gap-3 rounded-lg bg-solarized-base2 p-3 transition-colors hover:bg-solarized-base1"
							key={activity.id}
						>
							<div className="rounded-full bg-solarized-base3 p-2 shadow-sm">
								<activity.icon className="h-4 w-4 text-solarized-blue" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm text-solarized-base03">
									{activity.title}
								</p>
								<p className="text-solarized-base1 text-xs">vor {activity.time}</p>
							</div>
						</div>
					))
				) : (
					<div className="py-8 text-center">
						<Activity className="mx-auto mb-2 h-8 w-8 text-solarized-base2" />
						<p className="text-sm text-solarized-base01">Noch keine Aktivitäten</p>
					</div>
				)}
			</div>
		</CardContent>
	</Card>
);

export default async function DashboardPage() {
	// Auth check - must happen before queries
	const requestHeaders = await headers();
	const [session, subscriptions] = await Promise.all([
		getServerSession(),
		auth.api.listActiveSubscriptions({
			headers: requestHeaders,
		}),
	]).catch((_e) => {
		throw redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/dashboard")));
	});

	if (!session?.user) {
		redirect(createSignInRedirect(getRequestedPath(requestHeaders, "/dashboard")));
	}

	const activeSubscription = subscriptions.find(
		(sub) => sub.status === "active" || sub.status === "trialing",
	);

	// Use the shared getQueryClient for proper SSR caching
	const queryClient = getQueryClient();
	const usageQueryOptions = orpc.getUsage.queryOptions();
	const favouritesQueryOptions = orpc.templates.favourites.queryOptions();
	const authoredQueryOptions = orpc.templates.authored.queryOptions();
	const recentActivityQueryOptions = orpc.user.recentActivity.queryOptions();

	// PERF: Prefetch all queries in parallel
	// Using prefetchQuery allows streaming - the page can start rendering
	// while queries are still in flight, and data is hydrated to client
	await Promise.all([
		queryClient.prefetchQuery(usageQueryOptions),
		queryClient.prefetchQuery(favouritesQueryOptions),
		queryClient.prefetchQuery(authoredQueryOptions),
		queryClient.prefetchQuery(recentActivityQueryOptions),
	]);

	// Get the cached data for server rendering
	const data = queryClient.getQueryData(usageQueryOptions.queryKey);
	const favoriteTemplates = queryClient.getQueryData(favouritesQueryOptions.queryKey);
	const userTemplates = queryClient.getQueryData(authoredQueryOptions.queryKey);
	const recentEvents = queryClient.getQueryData(recentActivityQueryOptions.queryKey);

	const currentUsage = data?.usage?.count || 0;
	const monthlyUsageLimit = PRODUCT_PLANS[activeSubscription ? "plus" : "free"].scribeUsageLimit;
	const subscriptionPlanLabel = getSubscriptionPlanLabel(activeSubscription?.plan);
	const subscriptionStatus = getSubscriptionStatus(activeSubscription);
	const isAdmin = session.user.email === env.ADMIN_EMAIL;

	const recentActivity = getRecentActivityItems(recentEvents ?? []);
	const userDisplayName =
		session.user.name?.trim() || session.user.email.split("@")[0] || session.user.email;

	return (
		// HydrationBoundary passes prefetched data to any client components
		// that use useQuery with the same query keys
		<HydrationBoundary state={dehydrate(queryClient)}>
			<div className="h-full w-screen overflow-y-auto bg-gradient-to-br from-solarized-base3 via-solarized-base2 to-solarized-base2">
				<div className="container mx-auto max-w-7xl space-y-6 p-4 pb-16 sm:p-6">
					<DashboardHeader
						isAdmin={isAdmin}
						userDisplayName={userDisplayName}
						userImage={session.user.image}
					/>
					<DashboardQuickStats
						currentUsage={currentUsage}
						favoriteCount={favoriteTemplates?.length ?? 0}
						monthlyUsageLimit={monthlyUsageLimit}
						subscriptionPlanLabel={subscriptionPlanLabel}
						subscriptionStatus={subscriptionStatus}
						userTemplateCount={userTemplates?.length ?? 0}
					/>
					<AiFunctionsSection />
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
						<div className="lg:col-span-2">
							<FavoriteTemplatesCard templates={favoriteTemplates ?? []} />
						</div>
						<div className="space-y-6">
							<UserTemplatesCard templates={userTemplates ?? []} />
							<RecentActivityCard activities={recentActivity} />
						</div>
					</div>
				</div>
			</div>
		</HydrationBoundary>
	);
}
