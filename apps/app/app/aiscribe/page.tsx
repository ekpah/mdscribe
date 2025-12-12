import {
	Alert,
	AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { AlertCircle, FileEdit, UserPlus } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/auth";

export default async function AIScribeLandingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	const isLoggedIn = !!session?.user;

	return (
		<div className="container mx-auto flex h-full flex-col items-center p-4 py-8">
			<h1 className="mb-8 text-center font-bold text-3xl tracking-tight sm:text-4xl">
				AI Scribe
			</h1>

			{!isLoggedIn && (
				<>
					{/* Signup Banner */}
					<Alert className="mb-4 max-w-5xl" variant="default">
						<UserPlus className="h-4 w-4" />
						<AlertDescription>
							<span>
								Neu hier?{" "}
								<Link className="underline hover:text-primary" href="/sign-up">
									Registriere dich kostenlos
								</Link>{" "}
								um Zugang zu allen AI Scribe Funktionen zu erhalten!
							</span>
						</AlertDescription>
					</Alert>

					{/* Login Required Banner */}
					<Alert className="mb-6 max-w-5xl" variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							<span>
								Du musst dich{" "}
								<Link
									className="underline hover:text-primary"
									href="/sign-in?redirect=%2Faiscribe"
								>
									einloggen
								</Link>{" "}
								um diese Funktion nutzen zu können
							</span>
						</AlertDescription>
					</Alert>
				</>
			)}

			{/* Section: Dokument erstellen */}
			<div className="mb-12 w-full max-w-5xl">
				<h2 className="mb-4 font-semibold text-xl text-muted-foreground">
					Dokument erstellen
				</h2>
				<div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/er"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>ER Modus</CardTitle>
									<CardDescription>
										AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen,
										Differenzialdiagnosen und Dispositionen.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>ER Modus</CardTitle>
									<CardDescription>
										AI Scribe für Notaufnahme-Szenarien. Generiere Anamnesen,
										Differenzialdiagnosen und Dispositionen.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}

					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/icu"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>ICU Modus</CardTitle>
									<CardDescription>
										AI Scribe für Intensivstation-Szenarien. Generiere
										Anamnesen, Anamnesen, Differenzialdiagnosen und
										Dispositionen.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>ICU Modus</CardTitle>
									<CardDescription>
										AI Scribe für Intensivstation-Szenarien. Generiere
										Anamnesen, Anamnesen, Differenzialdiagnosen und
										Dispositionen.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}

					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/outpatient"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Ambulanter Modus</CardTitle>
									<CardDescription>
										AI Scribe für ambulante Konsultationen. Generiere
										professionelle Arztbriefe für Ihre ambulanten Patienten.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Ambulanter Modus</CardTitle>
									<CardDescription>
										AI Scribe für ambulante Konsultationen. Generiere
										professionelle Arztbriefe für Ihre ambulanten Patienten.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}

					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/procedures"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Prozeduren Modus</CardTitle>
									<CardDescription>
										AI Scribe für Prozeduren. Geben Sie Notizen ein und
										generiere Dokumentation für medizinische Eingriffe.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Prozeduren Modus</CardTitle>
									<CardDescription>
										AI Scribe für Prozeduren. Geben Sie Notizen ein und
										generiere Dokumentation für medizinische Eingriffe.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}

					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/discharge"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Entlassung Modus</CardTitle>
									<CardDescription>
										AI Scribe für Entlassungsbriefe. Geben Sie Notizen ein und
										generiere strukturierte Entlassungsdokumentation.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Entlassung Modus</CardTitle>
									<CardDescription>
										AI Scribe für Entlassungsbriefe. Geben Sie Notizen ein und
										generiere strukturierte Entlassungsdokumentation.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}

					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/diagnoseblock"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Diagnoseblock Update</CardTitle>
									<CardDescription>
										AI Scribe für Diagnoseblock Updates. Erstellen Sie
										aktualisierte Diagnoseblöcke basierend auf bestehenden
										Diagnosen.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<CardTitle>Diagnoseblock Update</CardTitle>
									<CardDescription>
										AI Scribe für Diagnoseblock Updates. Erstellen Sie
										aktualisierte Diagnoseblöcke basierend auf bestehenden
										Diagnosen.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}
				</div>
			</div>

			{/* Section: Arztbrief-Editor */}
			<div className="w-full max-w-5xl">
				<h2 className="mb-4 flex items-center gap-2 font-semibold text-xl text-muted-foreground">
					Arztbrief-Editor
					<Badge className="bg-solarized-cyan text-solarized-base03 shadow shadow-solarized-cyan/40 px-2.5 py-1 font-semibold tracking-wide uppercase">
						Beta
					</Badge>
				</h2>
				<div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
					{isLoggedIn ? (
						<Link
							className="block rounded-lg transition-shadow duration-200 hover:shadow-lg"
							href="/aiscribe/editor/er"
						>
							<Card className="flex h-full flex-col">
								<CardHeader>
									<div className="flex items-center gap-2">
										<FileEdit className="h-5 w-5 text-solarized-cyan" />
										<CardTitle>Notaufnahme Editor</CardTitle>
									</div>
									<CardDescription>
										Strukturierter Editor für Notaufnahme-Dokumentation mit
										KI-unterstützter Textverbesserung und Vorlagen.
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div className="block cursor-not-allowed rounded-lg opacity-50">
							<Card className="flex h-full flex-col">
								<CardHeader>
									<div className="flex items-center gap-2">
										<FileEdit className="h-5 w-5 text-solarized-cyan" />
										<CardTitle>Notaufnahme Editor</CardTitle>
									</div>
									<CardDescription>
										Strukturierter Editor für Notaufnahme-Dokumentation mit
										KI-unterstützter Textverbesserung und Vorlagen.
									</CardDescription>
								</CardHeader>
							</Card>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
