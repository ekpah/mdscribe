import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { CheckCircle2, Mail, MailCheck, Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";

export default async function VerificationPendingPage() {
	// Check session and redirect if email is already verified
	const session = await getServerSession();

	if (session?.user?.emailVerified) {
		redirect("/dashboard");
	}

	return (
		<div className="h-full w-full overflow-y-auto bg-gradient-to-b from-background to-muted/30">
			<div className="container mx-auto max-w-4xl px-4 py-6 sm:py-12">
				{/* Pending Verification Hero Section */}
				<div className="mb-10 space-y-5 text-center sm:mb-16 sm:space-y-6">
					<div className="flex justify-center">
						<div className="relative">
							<Mail
								className="h-12 w-12 text-solarized-blue sm:h-16 sm:w-16"
								strokeWidth={1.5}
							/>
							<div className="-top-1 -right-1 absolute">
								<div className="flex h-5 w-5 items-center justify-center rounded-full bg-solarized-orange">
									<div className="h-2 w-2 animate-pulse rounded-full bg-white" />
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-3 sm:space-y-4">
						<h1 className="px-2 font-bold text-3xl text-foreground leading-tight sm:text-4xl lg:text-5xl">
							Bestätige deine{" "}
							<span className="text-solarized-blue">E-Mail-Adresse</span>
						</h1>
						<p className="mx-auto max-w-2xl px-4 text-lg text-muted-foreground sm:px-0 sm:text-xl">
							Wir haben dir eine E-Mail mit einem Verifizierungslink geschickt.
							Bitte überprüfe dein Postfach und klicke auf den Link, um deine
							Registrierung abzuschließen.
						</p>
					</div>
				</div>

				{/* Information Cards */}
				<div className="space-y-6 sm:space-y-8">
					{/* Next Steps */}
					<div className="grid gap-4 px-2 sm:gap-6 sm:px-0 md:grid-cols-3">
						<Card className="border-solarized-blue/30 bg-solarized-blue/5">
							<CardHeader className="text-center">
								<div className="mb-3 flex justify-center">
									<MailCheck className="h-8 w-8 text-solarized-blue" />
								</div>
								<CardTitle className="text-base text-solarized-blue sm:text-lg">
									1. E-Mail öffnen
								</CardTitle>
								<CardDescription className="text-sm">
									Öffne die E-Mail, die wir dir gerade geschickt haben. Prüfe
									auch deinen Spam-Ordner.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-solarized-green/30 bg-solarized-green/5">
							<CardHeader className="text-center">
								<div className="mb-3 flex justify-center">
									<CheckCircle2 className="h-8 w-8 text-solarized-green" />
								</div>
								<CardTitle className="text-base text-solarized-green sm:text-lg">
									2. Link klicken
								</CardTitle>
								<CardDescription className="text-sm">
									Klicke auf den Verifizierungslink in der E-Mail, um dein Konto
									zu aktivieren.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="border-solarized-orange/30 bg-solarized-orange/5">
							<CardHeader className="text-center">
								<div className="mb-3 flex justify-center">
									<Shield className="h-8 w-8 text-solarized-orange" />
								</div>
								<CardTitle className="text-base text-solarized-orange sm:text-lg">
									3. Fertig!
								</CardTitle>
								<CardDescription className="text-sm">
									Nach der Verifizierung kannst du alle Funktionen von MDScribe
									nutzen.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>

					{/* Resend Email Section */}
					<div className="mx-2 space-y-5 rounded-2xl bg-muted/30 p-4 sm:mx-0 sm:space-y-6 sm:p-8">
						<div className="text-center">
							<h3 className="mb-2 font-bold text-foreground text-xl sm:text-2xl">
								Keine E-Mail erhalten?
							</h3>
							<p className="text-muted-foreground text-sm sm:text-base">
								Überprüfe deinen Spam-Ordner oder probiere dich erneut
								anzumelden - dann bekommst du eine neue E-Mail.
							</p>
						</div>

						<div className="flex flex-col items-center justify-center gap-3 px-2 sm:flex-row sm:gap-4 sm:px-0">
							<Button
								asChild
								className="w-full px-6 py-4 text-base sm:w-auto sm:px-8 sm:py-6 sm:text-lg"
								size="lg"
								type="button"
								variant="default"
							>
								<Link href="/sign-in">Zur Anmeldung</Link>
							</Button>
						</div>
					</div>

					{/* Help Section */}
					<div className="mx-2 space-y-4 rounded-2xl border border-border bg-card p-4 sm:mx-0 sm:p-6">
						<h4 className="font-semibold text-foreground text-lg">
							Häufige Probleme
						</h4>
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex gap-2">
								<span className="text-solarized-blue">•</span>
								<span>
									<strong>E-Mail nicht gefunden?</strong> Prüfe deinen Spam-
									oder Junk-Ordner
								</span>
							</li>
							<li className="flex gap-2">
								<span className="text-solarized-blue">•</span>
								<span>
									<strong>Link funktioniert nicht?</strong> Der Link ist 60
									Minuten gültig. Fordere eine neue E-Mail an
								</span>
							</li>
							<li className="flex gap-2">
								<span className="text-solarized-blue">•</span>
								<span>
									<strong>Falsche E-Mail-Adresse?</strong> Registriere dich
									erneut mit der korrekten E-Mail-Adresse
								</span>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
