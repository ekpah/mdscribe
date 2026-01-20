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
	Database,
	FileText,
	FlaskConical,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import Link from "next/link";

interface AdminCardProps {
	title: string;
	description: string;
	href: string;
	icon: React.ReactNode;
	status?: "active" | "coming-soon";
}

function AdminCard({
	title,
	description,
	href,
	icon,
	status = "active",
}: AdminCardProps) {
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
}

const adminFeatures: AdminCardProps[] = [
	{
		title: "AI Playground",
		description:
			"Experimentiere mit verschiedenen KI-Modellen, Prompts und Parametern. Vergleiche Modelle nebeneinander und teste multimodale Eingaben.",
		href: "/admin/playground",
		icon: <FlaskConical className="h-5 w-5 text-solarized-violet" />,
		status: "active",
	},
	{
		title: "Embedding-Migration",
		description:
			"Verwalten und Ausführen von Template-Embedding-Migrationen. Fehlende Embeddings generieren oder alle Embeddings mit konfigurierbaren Batch-Einstellungen neu erstellen.",
		href: "/admin/migrateEmbeddings",
		icon: <Database className="h-5 w-5 text-solarized-blue" />,
		status: "active",
	},
	{
		title: "Benutzerverwaltung",
		description:
			"Benutzerkonten, Berechtigungen und Zugriffskontrollen auf der Plattform anzeigen und verwalten.",
		href: "/admin/users",
		icon: <Users className="h-5 w-5 text-solarized-cyan" />,
		status: "active",
	},
	{
		title: "Nutzungsstatistik",
		description:
			"Alle AI-Generierungen einsehen. Token-Nutzung, Kosten und Modelle pro Anfrage analysieren.",
		href: "/admin/usage",
		icon: <Activity className="h-5 w-5 text-solarized-green" />,
		status: "active",
	},
	{
		title: "Dokumenten-Playground",
		description:
			"PDF-Formulare testen, Eingaben extrahieren und Sprachausfüllung für Inputs ausprobieren.",
		href: "/admin/documents-playground",
		icon: <FileText className="h-5 w-5 text-solarized-magenta" />,
		status: "active",
	},
	{
		title: "Vorlagenverwaltung",
		description:
			"Dokumentenvorlagen durchsuchen, bearbeiten und verwalten. Vorlagennutzung und Leistungsmetriken überprüfen.",
		href: "/admin/templates",
		icon: <FileText className="h-5 w-5 text-solarized-magenta" />,
		status: "coming-soon",
	},
	{
		title: "Systemeinstellungen",
		description:
			"Systemweite Einstellungen, API-Schlüssel und Integrationsoptionen konfigurieren.",
		href: "/admin/settings",
		icon: <Settings className="h-5 w-5 text-solarized-yellow" />,
		status: "coming-soon",
	},
];

export default function AdminDashboardPage() {
	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
				{/* Welcome Section */}
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
							<Shield className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">
								Admin-Dashboard
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								Verwalten Sie Ihre MDScribe-Plattform von hier aus
							</p>
						</div>
					</div>
				</div>

				{/* Quick Stats */}
				<Card className="border-solarized-base2 bg-gradient-to-br from-solarized-base3 to-solarized-base2/50">
					<CardContent className="p-4 sm:pt-6">
						<div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Status
								</p>
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 animate-pulse rounded-full bg-solarized-green" />
									<p className="font-semibold text-base text-solarized-green sm:text-lg">
										Online
									</p>
								</div>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Umgebung
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{process.env.NODE_ENV === "production"
										? "Produktion"
										: "Entwicklung"}
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Admin-Tools
								</p>
								<p className="font-semibold text-base text-solarized-base00 sm:text-lg">
									{adminFeatures.filter((f) => f.status === "active").length}{" "}
									Aktiv
								</p>
							</div>
							<div className="space-y-1">
								<p className="font-medium text-solarized-base01 text-xs sm:text-sm">
									Geplant
								</p>
								<p className="font-semibold text-base text-solarized-base01 sm:text-lg">
									{
										adminFeatures.filter((f) => f.status === "coming-soon")
											.length
									}{" "}
									Funktionen
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Admin Tools Grid */}
				<div className="space-y-3 sm:space-y-4">
					<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
						Admin-Tools
					</h2>
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
