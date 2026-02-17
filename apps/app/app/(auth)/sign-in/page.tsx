"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";

export default function SignIn() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectParam = searchParams.get("redirect");
	const redirect =
		!redirectParam || redirectParam === "/" ? "/dashboard" : redirectParam;

	return (
		<Card className="w-full max-w-md" data-testid="sign-in-card">
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					setLoading(true);
					try {
						await signIn.email(
							{ email, password, rememberMe, callbackURL: redirect },
							{
								onRequest: () => {
									//show loading
									setLoading(true);
								},
								onSuccess: () => {
									//redirect to the original page or dashboard
									router.push(redirect);
									setLoading(false);
								},
								onError: (ctx) => {
									// Handle the error 403 - not email verified
									if (ctx.error.status === 403) {
										toast.error("Bitte bestätigen Sie Ihre E-Mail-Adresse");
									} else {
										toast.error(ctx.error.message);
									}
									setLoading(false);
								},
							},
						);
					} finally {
						setLoading(false);
					}
				}}
			>
				<CardHeader className="space-y-1">
					<CardTitle className="text-center font-bold text-2xl">
						In Ihren Account einloggen
					</CardTitle>
					<CardDescription className="text-center">
						Geben Sie unten Ihre E-Mail und Ihr Passwort ein, um sich anzumelden
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">E-Mail</Label>
						<Input
							id="email"
							onChange={(e) => setEmail(e.target.value)}
							placeholder="m@beispiel.de"
							required
							type="email"
							value={email}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Passwort</Label>
						<Input
							id="password"
							onChange={(e) => setPassword(e.target.value)}
							required
							type="password"
							value={password}
						/>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							checked={rememberMe}
							id="remember"
							onClick={() => setRememberMe(!rememberMe)}
						/>
						<Label htmlFor="remember">Angemeldet bleiben</Label>
					</div>

					<Button className="w-full" disabled={loading} type="submit">
						{loading ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							"Anmelden"
						)}
					</Button>
				</CardContent>
				<CardFooter className="flex flex-wrap items-center justify-between gap-2">
					<div className="text-muted-foreground text-sm">
						<span className="mr-1">Noch kein Konto?</span>
						<Link className="text-primary hover:underline" href="/sign-up">
							Registrieren
						</Link>
					</div>
					<Link
						className="text-primary text-sm hover:underline"
						href="/forgot-password"
					>
						Passwort vergessen?
					</Link>
					<p className="text-muted-foreground text-xs">
						Mit der Anmeldung akzeptieren Sie unsere{" "}
						<Link
							className="text-primary hover:underline"
							href="/legal?tab=datenschutz"
						>
							Datenschutzerklärung
						</Link>{" "}
						und unsere{" "}
						<Link
							className="text-primary hover:underline"
							href="/legal?tab=agb"
						>
							Geschäftsbedingungen
						</Link>
						.
					</p>
					<p className="mt-4 w-full text-center text-muted-foreground text-xs">
						Die Informationen auf dieser Website dienen ausschließlich zu
						Bildungszwecken und Vereinfachung der Dokumentation, stellen jedoch
						keine medizinische Beratung dar. Sie ersetzen nicht die Konsultation
						eines Arztes / einer Ärztin.
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
