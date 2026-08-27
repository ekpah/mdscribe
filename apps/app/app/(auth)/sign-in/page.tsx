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
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { trackEvent } from "@/lib/analytics";
import { signIn } from "@/lib/auth-client";
import { getSafeRedirectPath } from "@/lib/sign-in-redirect";
import { USER_MESSAGES } from "@/lib/user-messages";

export default function SignIn() {
	const [identifier, setIdentifier] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectParam = searchParams.get("redirect");
	const redirect = getSafeRedirectPath(redirectParam);

	const handleIdentifierChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setIdentifier(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value);
	}, []);

	const handleRememberMeClick = useCallback(() => {
		setRememberMe((current) => !current);
	}, []);

	const handleSubmit = useCallback(
		async (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setLoading(true);
			const value = identifier.trim();
			// An "@" means it's an email; otherwise treat it as a username.
			const isEmail = value.includes("@");
			const fetchOptions = {
				onError: (ctx: { error: { status: number } }) => {
					// Handle the error 403 - not email verified
					if (ctx.error.status === 403) {
						toast.error(USER_MESSAGES.signIn.emailNotVerified);
					} else {
						toast.error(USER_MESSAGES.signIn.failed);
					}
					setLoading(false);
				},
				onRequest: () => {
					setLoading(true);
				},
				onSuccess: () => {
					trackEvent("user-login", { method: isEmail ? "email" : "username" });
					router.push(redirect);
					setLoading(false);
				},
			};
			try {
				await (isEmail
					? signIn.email(
							{ callbackURL: redirect, email: value, password, rememberMe },
							fetchOptions,
						)
					: signIn.username({ password, rememberMe, username: value }, fetchOptions));
			} finally {
				setLoading(false);
			}
		},
		[identifier, password, redirect, rememberMe, router],
	);

	return (
		<Card className="w-full max-w-md" data-testid="sign-in-card">
			<form onSubmit={handleSubmit}>
				<CardHeader className="space-y-1">
					<CardTitle className="text-center font-bold text-2xl">
						In Ihren Account einloggen
					</CardTitle>
					<CardDescription className="text-center">
						Geben Sie unten Ihre E-Mail oder Ihren Benutzernamen und Ihr Passwort ein, um sich
						anzumelden
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="identifier">E-Mail oder Benutzername</Label>
						<Input
							autoComplete="username"
							id="identifier"
							onChange={handleIdentifierChange}
							placeholder="m@beispiel.de oder benutzername"
							required
							value={identifier}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Passwort</Label>
						<Input
							id="password"
							onChange={handlePasswordChange}
							required
							type="password"
							value={password}
						/>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox checked={rememberMe} id="remember" onClick={handleRememberMeClick} />
						<Label htmlFor="remember">Angemeldet bleiben</Label>
					</div>

					<Button className="w-full" disabled={loading} type="submit">
						{loading ? <Loader2 className="animate-spin" size={16} /> : "Anmelden"}
					</Button>
				</CardContent>
				<CardFooter className="flex flex-wrap items-center justify-between gap-2">
					<div className="text-muted-foreground text-sm">
						<span className="mr-1">Noch kein Konto?</span>
						<Link className="text-primary hover:underline" href="/sign-up">
							Registrieren
						</Link>
					</div>
					<Link className="text-primary text-sm hover:underline" href="/forgot-password">
						Passwort vergessen?
					</Link>
					<p className="text-muted-foreground text-xs">
						Mit der Anmeldung akzeptieren Sie unsere{" "}
						<Link className="text-primary hover:underline" href="/legal?tab=datenschutz">
							Datenschutzerklärung
						</Link>{" "}
						und unsere{" "}
						<Link className="text-primary hover:underline" href="/legal?tab=agb">
							Geschäftsbedingungen
						</Link>
						.
					</p>
					<p className="mt-4 w-full text-center text-muted-foreground text-xs">
						Die Informationen auf dieser Website dienen ausschließlich zu Bildungszwecken und
						Vereinfachung der Dokumentation, stellen jedoch keine medizinische Beratung dar. Sie
						ersetzen nicht die Konsultation eines Arztes / einer Ärztin.
					</p>
				</CardFooter>
			</form>
		</Card>
	);
}
