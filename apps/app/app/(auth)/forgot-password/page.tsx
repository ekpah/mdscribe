"use client";

import { authClient } from "@/lib/auth-client";
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotPassword() {
	const [email, setEmail] = useState("");
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	return (
		<Card className="z-50 max-w-md rounded-md rounded-t-none">
			<CardHeader>
				<CardTitle className="text-lg md:text-xl">
					Passwort zurücksetzen
				</CardTitle>
				<CardDescription className="text-xs md:text-sm">
					Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="email">E-Mail</Label>
						<Input
							id="email"
							type="email"
							placeholder="m@beispiel.de"
							required
							onChange={(e) => {
								setEmail(e.target.value);
							}}
							value={email}
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={loading}
						onClick={async () => {
							setLoading(true);
							try {
								const { error } = await authClient.requestPasswordReset({
									email,
									redirectTo: "/reset-password",
								});

								if (error) {
									toast.error(error?.message || "Ein Fehler ist aufgetreten");
									return;
								}

								toast.success(
									"Eine E-Mail zum Zurücksetzen des Passworts wurde gesendet",
								);
								router.push("/sign-in");
							} catch (err) {
								toast.error("Ein Fehler ist aufgetreten");
							} finally {
								setLoading(false);
							}
						}}
					>
						{loading ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							"Link zum Zurücksetzen senden"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
