import {
	Alert,
	AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	AlertCircle,
	ArrowRight,
	Bed,
	ClipboardList,
	Edit3,
	FileEdit,
	FileText,
	Heart,
	PenTool,
	Stethoscope,
	Syringe,
	UserPlus,
	Zap,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/auth";

interface ScribeCardProps {
	title: string;
	description: string;
	href: string;
	icon: React.ReactNode;
	isLoggedIn: boolean;
	accentColor?: string;
}

function ScribeCard({
	title,
	description,
	href,
	icon,
	isLoggedIn,
	accentColor = "solarized-blue",
}: ScribeCardProps) {
	if (!isLoggedIn) {
		return (
			<div className="block cursor-not-allowed">
				<Card className="h-full border-solarized-base2 opacity-50">
					<CardHeader className="p-4 sm:p-5">
						<div className="flex items-center justify-between">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-solarized-base2 sm:h-9 sm:w-9">
								{icon}
							</div>
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
			<Card
				className={`h-full border-solarized-base2 transition-all duration-200 hover:border-${accentColor} hover:shadow-md`}
			>
				<CardHeader className="p-4 sm:p-5">
					<div className="flex items-center justify-between">
						<div
							className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-${accentColor}/10 transition-colors group-hover:bg-${accentColor}/20 sm:h-9 sm:w-9`}
						>
							{icon}
						</div>
						<ArrowRight className="h-4 w-4 text-solarized-base01 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
					</div>
					<CardTitle
						className={`mt-3 text-sm text-solarized-base00 group-hover:text-${accentColor} sm:text-base`}
					>
						{title}
					</CardTitle>
					<CardDescription className="line-clamp-2 text-xs text-solarized-base01 sm:text-sm">
						{description}
					</CardDescription>
				</CardHeader>
			</Card>
		</Link>
	);
}

const quickGenerationModes = [
	{
		title: "ER Modus",
		description:
			"AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen, Differenzialdiagnosen und Dispositionen.",
		href: "/aiscribe/er",
		icon: <Heart className="h-4 w-4 text-solarized-red sm:h-5 sm:w-5" />,
		accentColor: "solarized-red",
	},
	{
		title: "ICU Modus",
		description:
			"AI Scribe für Intensivstation-Szenarien. Generiere Anamnesen, Differenzialdiagnosen und Dispositionen.",
		href: "/aiscribe/icu",
		icon: <Bed className="h-4 w-4 text-solarized-orange sm:h-5 sm:w-5" />,
		accentColor: "solarized-orange",
	},
	{
		title: "Ambulanter Modus",
		description:
			"AI Scribe für ambulante Konsultationen. Generiere professionelle Arztbriefe für ambulante Patienten.",
		href: "/aiscribe/outpatient",
		icon: (
			<Stethoscope className="h-4 w-4 text-solarized-green sm:h-5 sm:w-5" />
		),
		accentColor: "solarized-green",
	},
	{
		title: "Prozeduren Modus",
		description:
			"AI Scribe für Prozeduren. Dokumentation für medizinische Eingriffe generieren.",
		href: "/aiscribe/procedures",
		icon: <Syringe className="h-4 w-4 text-solarized-violet sm:h-5 sm:w-5" />,
		accentColor: "solarized-violet",
	},
	{
		title: "Entlassung Modus",
		description:
			"AI Scribe für Entlassungsbriefe. Strukturierte Entlassungsdokumentation erstellen.",
		href: "/aiscribe/discharge",
		icon: <FileText className="h-4 w-4 text-solarized-blue sm:h-5 sm:w-5" />,
		accentColor: "solarized-blue",
	},
	{
		title: "Diagnoseblock Update",
		description:
			"Aktualisierte Diagnoseblöcke basierend auf bestehenden Diagnosen erstellen.",
		href: "/aiscribe/diagnoseblock",
		icon: (
			<ClipboardList className="h-4 w-4 text-solarized-yellow sm:h-5 sm:w-5" />
		),
		accentColor: "solarized-yellow",
	},
];

const editorModes = [
	{
		title: "Notaufnahme Editor",
		description:
			"Strukturierter Editor für Notaufnahme-Dokumentation mit KI-unterstützter Textverbesserung und Vorlagen.",
		href: "/aiscribe/editor/er",
		icon: <FileEdit className="h-4 w-4 text-solarized-cyan sm:h-5 sm:w-5" />,
		accentColor: "solarized-cyan",
	},
	{
		title: "ICU Editor",
		description:
			"Strukturierter Editor für ICU-Entlassungsbriefe mit KI-unterstützter Dokumentation.",
		href: "/aiscribe/editor/icu",
		icon: <Edit3 className="h-4 w-4 text-solarized-magenta sm:h-5 sm:w-5" />,
		accentColor: "solarized-magenta",
	},
];

export default async function AIScribeLandingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	const isLoggedIn = !!session?.user;

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
								<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl">
									AI Scribe
								</h1>
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
									<Link
										className="font-medium underline"
										href="/sign-in?redirect=%2Faiscribe"
									>
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
							Wählen Sie einen Modus, geben Sie Ihre Notizen ein und erhalten
							Sie sofort ein KI-generiertes Dokument.
						</p>
						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
							{quickGenerationModes.map((mode) => (
								<ScribeCard
									key={mode.title}
									title={mode.title}
									description={mode.description}
									href={mode.href}
									icon={mode.icon}
									isLoggedIn={isLoggedIn}
									accentColor={mode.accentColor}
								/>
							))}
						</div>
					</div>

					{/* Editor Section */}
					<div className="space-y-3 sm:space-y-4">
						<div className="flex items-center gap-2">
							<Edit3 className="h-5 w-5 text-solarized-cyan" />
							<h2 className="font-semibold text-base text-solarized-base00 sm:text-lg">
								Arztbrief-Editor
							</h2>
							<Badge className="bg-solarized-cyan px-2 py-0.5 font-semibold text-xs text-solarized-base03 uppercase shadow shadow-solarized-cyan/30">
								Beta
							</Badge>
						</div>
						<p className="text-xs text-solarized-base01 sm:text-sm">
							Strukturierte Editoren mit Vorlagen und KI-gestützter
							Textverbesserung für komplexere Dokumentation.
						</p>
						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
							{editorModes.map((mode) => (
								<ScribeCard
									key={mode.title}
									title={mode.title}
									description={mode.description}
									href={mode.href}
									icon={mode.icon}
									isLoggedIn={isLoggedIn}
									accentColor={mode.accentColor}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
