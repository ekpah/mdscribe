import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Activity, ArrowRight, Database, FlaskConical, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import { MonthlyActiveUsersChart } from "./_components/monthly-active-users-chart-dynamic";

interface AdminCardProps {
	title: string;
	description: string;
	href: string;
	icon: React.ReactNode;
	status?: "active" | "coming-soon";
}

const AdminCard = ({ title, description, href, icon, status = "active" }: AdminCardProps) => {
	const isActive = status === "active";

	if (!isActive) {
		return (
			<Card className="h-full border-solarized-base2 opacity-60">
				<CardHeader className="p-4 sm:p-6">
					<div className="flex items-center justify-between">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-solarized-base2 sm:h-10 sm:w-10">
							{icon}
						</div>
						<span className="rounded-full bg-solarized-base2 px-2 py-0.5 font-medium text-solarized-base01 text-[10px] sm:py-1 sm:text-xs">
							In Kürze
						</span>
					</div>
					<CardTitle className="mt-3 text-sm text-solarized-base00 sm:mt-4 sm:text-base">
						{title}
					</CardTitle>
					<CardDescription className="text-xs text-solarized-base01 sm:text-sm">
						{description}
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Link href={href} className="group block h-full">
			<Card className="h-full border-solarized-base2 transition-all duration-200 hover:border-solarized-blue hover:shadow-md">
				<CardHeader className="p-4 sm:p-6">
					<div className="flex items-center justify-between">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-solarized-blue/10 transition-colors group-hover:bg-solarized-blue/20 sm:h-10 sm:w-10">
							{icon}
						</div>
						<ArrowRight className="h-4 w-4 text-solarized-base01 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 sm:h-5 sm:w-5" />
					</div>
					<CardTitle className="mt-3 text-sm text-solarized-base00 group-hover:text-solarized-blue sm:mt-4 sm:text-base">
						{title}
					</CardTitle>
					<CardDescription className="text-xs text-solarized-base01 sm:text-sm">
						{description}
					</CardDescription>
				</CardHeader>
			</Card>
		</Link>
	);
};

interface AdminSection {
	title: string;
	description: string;
	features: AdminCardProps[];
}

const adminSections: AdminSection[] = [
	{
		description: "Zentrale Einstellungen und Informationen für den Betrieb dieser Instanz.",
		features: [
			{
				description: "KI-Anbieter, Modelle, API-Schlüssel und Integrationsoptionen konfigurieren.",
				href: "/admin/settings/models",
				icon: <Settings className="h-5 w-5 text-solarized-yellow" />,
				status: "active",
				title: "Systemeinstellungen",
			},
			{
				description:
					"React-Email-Entwürfe prüfen und einzelne Test-E-Mails sicher an manuelle Empfänger senden.",
				href: "/admin/emails",
				icon: <Mail className="h-5 w-5 text-solarized-blue" />,
				status: "active",
				title: "E-Mail Entwürfe",
			},
		],
		title: "System & Betrieb",
	},
	{
		description: "Nutzung, Benutzerkonten und gemeinsam verfügbare Inhalte verwalten.",
		features: [
			{
				description:
					"Alle AI-Generierungen einsehen. Token-Nutzung, Kosten und Modelle pro Anfrage analysieren.",
				href: "/admin/usage",
				icon: <Activity className="h-5 w-5 text-solarized-green" />,
				status: "active",
				title: "Nutzungsstatistik",
			},
			{
				description:
					"Benutzerkonten, Berechtigungen und Zugriffskontrollen auf der Plattform anzeigen und verwalten.",
				href: "/admin/users",
				icon: <Users className="h-5 w-5 text-solarized-cyan" />,
				status: "active",
				title: "Benutzerverwaltung",
			},
			{
				description: "Zentrale Übersicht aller Templates inklusive Favoriten und Autoren-Filter.",
				href: "/admin/templates",
				icon: <Database className="h-5 w-5 text-solarized-blue" />,
				status: "active",
				title: "Template Management",
			},
		],
		title: "Verwaltung",
	},
	{
		description: "Prompts, Modelle und Parameter mit realistischen Eingaben ausprobieren.",
		features: [
			{
				description: "KI-Generierungen mit frei wählbaren Modellen, Prompts und Parametern testen.",
				href: "/admin/playground",
				icon: <FlaskConical className="h-5 w-5 text-solarized-violet" />,
				status: "active",
				title: "AI-Playground",
			},
		],
		title: "Entwicklung & Tests",
	},
];

export default async function AdminDashboardPage() {
	const queryClient = getQueryClient();
	const [monthlyStats, weeklyStats, monthlyActiveUsers] = await Promise.all([
		queryClient.fetchQuery(
			orpc.admin.usage.stats.queryOptions({
				input: { filter: "month" },
			}),
		),
		queryClient.fetchQuery(
			orpc.admin.usage.stats.queryOptions({
				input: { filter: "week" },
			}),
		),
		queryClient.fetchQuery(
			orpc.admin.usage.monthlyActiveUsers.queryOptions({
				input: {},
			}),
		),
	]);

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
				{/* Quick Stats */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">Status</p>
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 animate-pulse rounded-full bg-solarized-green" />
									<p className="font-semibold text-base text-solarized-green sm:text-lg">Online</p>
								</div>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Monatlich aktive Nutzer
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{monthlyStats.activeUsers}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Wöchentliche KI-Events
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{weeklyStats.totalEvents}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<MonthlyActiveUsersChart
					timeZone={monthlyActiveUsers.timeZone}
					trend={monthlyActiveUsers.trend}
					weeklyRequests={monthlyActiveUsers.weeklyRequests}
				/>

				<div className="space-y-8 sm:space-y-10">
					{adminSections.map((section) => (
						<section key={section.title} className="space-y-3 sm:space-y-4">
							<div className="space-y-1">
								<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{section.title}
								</h2>
								<p className="text-solarized-base01 text-xs sm:text-sm">{section.description}</p>
							</div>
							<div className="grid gap-3 sm:gap-4 md:grid-cols-2">
								{section.features.map((feature) => (
									<AdminCard key={feature.title} {...feature} />
								))}
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
