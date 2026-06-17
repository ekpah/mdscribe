import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Activity,
	ArrowRight,
	Bot,
	Database,
	FileAudio,
	FileText,
	FlaskConical,
	KeyRound,
	Mail,
	NotebookTabs,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";

import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

import { MonthlyActiveUsersChart } from "./_components/monthly-active-users-chart";

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

const adminFeatures: AdminCardProps[] = [
	{
		description:
			"Experimentiere mit verschiedenen KI-Modellen, Prompts und Parametern. Vergleiche Modelle nebeneinander und teste multimodale Eingaben.",
		href: "/admin/playground",
		icon: <FlaskConical className="h-5 w-5 text-solarized-violet" />,
		status: "active",
		title: "AI Playground",
	},
	{
		description:
			"Zentrale Übersicht aller Templates inklusive Embedding-Verwaltung, Favoriten und Autoren-Filter.",
		href: "/admin/templates",
		icon: <Database className="h-5 w-5 text-solarized-blue" />,
		status: "active",
		title: "Template Management",
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
		description:
			"Alle AI-Generierungen einsehen. Token-Nutzung, Kosten und Modelle pro Anfrage analysieren.",
		href: "/admin/usage",
		icon: <Activity className="h-5 w-5 text-solarized-green" />,
		status: "active",
		title: "Nutzungsstatistik",
	},
	{
		description:
			"Zwei KI-Modelle mit zufälligen historischen Inputs gegeneinander testen und Präferenzen auswerten.",
		href: "/admin/model-comparison",
		icon: <Bot className="h-5 w-5 text-solarized-violet" />,
		status: "active",
		title: "AI-Modell-Vergleich",
	},
	{
		description:
			"PDF-Dateien mit auswählbarem OCR/File/Image-Modell zu Markdoc oder Text verarbeiten.",
		href: "/admin/documents-playground",
		icon: <FileText className="h-5 w-5 text-solarized-magenta" />,
		status: "active",
		title: "Dokumenten-Playground",
	},
	{
		description:
			"Audio aufnehmen, Transkriptionsmodell wechseln und das erzeugte Transkript prüfen.",
		href: "/admin/input-playground",
		icon: <FileAudio className="h-5 w-5 text-solarized-blue" />,
		status: "active",
		title: "Audio-Playground",
	},
	{
		description:
			"React-Email-Entwürfe prüfen und einzelne Test-E-Mails sicher an manuelle Empfänger senden.",
		href: "/admin/emails",
		icon: <Mail className="h-5 w-5 text-solarized-blue" />,
		status: "active",
		title: "E-Mail Entwürfe",
	},
	{
		description: "Markdoc-Vorlagen, Tags, Eingabefelder und gerenderte Ausgabe intern prüfen.",
		href: "/admin/markdoc-playground",
		icon: <NotebookTabs className="h-5 w-5 text-solarized-cyan" />,
		status: "active",
		title: "Markdoc-Playground",
	},
	{
		description: "KI-Anbieter, Modelle, API-Schlüssel und Integrationsoptionen konfigurieren.",
		href: "/admin/settings/models",
		icon: <Settings className="h-5 w-5 text-solarized-yellow" />,
		status: "active",
		title: "Systemeinstellungen",
	},
	{
		description:
			"Lizenzstatus, freigeschaltete Edition und Nutzer-Sitze dieser Installation einsehen.",
		href: "/admin/license",
		icon: <KeyRound className="h-5 w-5 text-solarized-blue" />,
		status: "active",
		title: "Lizenz",
	},
];

export default async function AdminDashboardPage() {
	const queryClient = getQueryClient();
	const [monthlyStats, weeklyStats, monthlyActiveUsers, license] = await Promise.all([
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
		queryClient.fetchQuery(orpc.admin.license.get.queryOptions()),
	]);

	let licenseLabel: string;
	if (!license.isConfigured) {
		licenseLabel = "Community";
	} else if (license.isExpired) {
		licenseLabel = "Abgelaufen";
	} else {
		licenseLabel = "Lizenziert";
	}
	const licenseSeatSuffix =
		license.maxSeats === null ? null : ` · ${license.seatCount}/${license.maxSeats}`;
	const licenseColorClass = license.isExpired
		? "text-solarized-yellow"
		: "text-solarized-base00";

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
				{/* Quick Stats */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">Status</p>
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 animate-pulse rounded-full bg-solarized-green" />
									<p className="font-semibold text-base text-solarized-green sm:text-lg">Online</p>
								</div>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">Lizenz</p>
								<p className={`font-semibold text-base sm:text-lg ${licenseColorClass}`}>
									{licenseLabel}
									{licenseSeatSuffix ? (
										<span className="font-normal text-solarized-base01 text-sm">
											{licenseSeatSuffix}
										</span>
									) : null}
								</p>
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

				{/* Admin Tools Grid */}
				<div className="space-y-3 sm:space-y-4">
					<div className="grid gap-3 sm:gap-4 md:grid-cols-2">
						{adminFeatures.map((feature) => (
							<AdminCard key={feature.title} {...feature} />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
