"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";

export default function SignUp() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirmation, setPasswordConfirmation] = useState("");
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const handleEmailChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setEmail(event.target.value);
		},
		[],
	);

	const handlePasswordChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setPassword(event.target.value);
		},
		[],
	);

	const handlePasswordConfirmationChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setPasswordConfirmation(event.target.value);
		},
		[],
	);

	const handleSignUp = useCallback(async () => {
		if (password !== passwordConfirmation) {
			toast.error("Passwörter stimmen nicht überein");
			return;
		}

		await signUp.email({
			callbackURL: "/email-verified",
			email,
			fetchOptions: {
				onError: (ctx) => {
					toast.error(ctx.error.message);
				},
				onRequest: () => {
					setLoading(true);
				},
				onResponse: () => {
					setLoading(false);
				},
				onSuccess: () => {
					toast.success("Konto erstellt! Bitte bestätige deine E-Mail.");
					router.push("/verification-pending");
				},
			},
			name: email.split("@")[0] || "User",
			password,
		});
	}, [email, password, passwordConfirmation, router]);

	return (
		<Card
			className="z-50 max-w-md rounded-md rounded-t-none"
			data-testid="sign-up-card"
		>
			<CardHeader>
				<CardTitle className="text-lg md:text-xl">Registrieren</CardTitle>
				<CardDescription className="text-xs md:text-sm">
					Geben Sie Ihre Informationen ein, um ein Konto zu erstellen
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">E-Mail</Label>
							<Input
								id="email"
								onChange={handleEmailChange}
							placeholder="m@beispiel.de"
							required
							type="email"
							value={email}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Passwort</Label>
							<Input
								autoComplete="new-password"
								id="password"
								onChange={handlePasswordChange}
							placeholder="Passwort"
							type="password"
							value={password}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Passwort bestätigen</Label>
							<Input
								autoComplete="new-password"
								id="password_confirmation"
								onChange={handlePasswordConfirmationChange}
							placeholder="Passwort bestätigen"
							type="password"
							value={passwordConfirmation}
						/>
					</div>

						<Button
							className="w-full"
							disabled={loading}
							onClick={handleSignUp}
							type="submit"
						>
						{loading ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							"Konto erstellen"
						)}
					</Button>
					<p className="text-muted-foreground text-xs">
						Mit der Registrierung akzeptieren Sie unsere{" "}
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
				</div>
			</CardContent>
		</Card>
	);
}
