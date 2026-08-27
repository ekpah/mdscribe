"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/design-system/components/ui/form";
import { Input } from "@repo/design-system/components/ui/input";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { unwrapAuthClientResult } from "@/lib/auth-client-result";
import { USER_MESSAGES } from "@/lib/user-messages";

const PROFILE_UPDATE_ERROR =
	"Dein Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.";

const resolveUpdateErrorMessage = (error: unknown): string => {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: string }).code === "USERNAME_IS_ALREADY_TAKEN"
	) {
		return USER_MESSAGES.userNameAlreadyTaken;
	}
	return PROFILE_UPDATE_ERROR;
};

const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;

const profileFormSchema = z.object({
	email: z
		.string()
		.email({
			message: "Bitte gib eine gültige E-Mail-Adresse ein.",
		})
		.optional(),
	name: z.string().max(30, {
		message: USER_MESSAGES.userNameMaxLength,
	}),
	username: z
		.string()
		.trim()
		.min(3, { message: "Benutzername: mindestens 3 Zeichen." })
		.max(30, { message: "Benutzername darf nicht länger als 30 Zeichen sein." })
		.regex(USERNAME_PATTERN, {
			message: "Benutzername: nur Buchstaben, Zahlen, Punkt und Unterstrich.",
		}),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileCardProps {
	user: {
		email: string;
		name: string | null;
		username?: string | null;
	};
	isLoading: boolean;
	setIsLoading: (value: boolean) => void;
}

export const ProfileCard = ({ user, isLoading, setIsLoading }: ProfileCardProps) => {
	const router = useRouter();
	const displayNamePlaceholder = user.email.split("@")[0] || user.email;
	const form = useForm<ProfileFormValues>({
		defaultValues: {
			email: "",
			name: "",
			username: "",
		},
		resolver: zodResolver(profileFormSchema),
	});

	useEffect(() => {
		if (user) {
			form.reset({
				email: user.email || "",
				name: user.name ?? "",
				username: user.username ?? "",
			});
		}
	}, [user, form]);

	const onSubmit = useCallback(
		(data: ProfileFormValues) => {
			setIsLoading(true);
			// Only send the username when it actually changed — re-submitting the
			// same handle would otherwise trip the uniqueness check.
			const nextUsername = data.username.trim();
			const usernameChanged = nextUsername.toLowerCase() !== (user.username ?? "").toLowerCase();

			// better-auth client methods resolve with `{ data, error }` instead of
			// throwing, so surface the error explicitly for toast.promise + the form.
			const runUpdate = async () => {
				const result = await authClient.updateUser({
					name: data.name.trim(),
					...(usernameChanged ? { username: nextUsername } : {}),
				});
				const updatedUser = unwrapAuthClientResult(result);
				router.refresh();
				return updatedUser;
			};

			toast.promise(runUpdate(), {
				error: (error: unknown) => {
					const message = resolveUpdateErrorMessage(error);
					if (message === USER_MESSAGES.userNameAlreadyTaken) {
						form.setError("username", { message, type: "server" });
					}
					return message;
				},
				finally: () => setIsLoading(false),
				loading: "Dein Profil wird aktualisiert...",
				success: "Dein Profil wurde erfolgreich aktualisiert.",
			});
		},
		[setIsLoading, user.username, form, router],
	);

	const renderDisplayNameField = useCallback(
		({ field }: { field: ControllerRenderProps<ProfileFormValues, "name"> }) => (
			<FormItem>
				<FormLabel>Anzeigename</FormLabel>
				<FormControl>
					<Input maxLength={30} placeholder={displayNamePlaceholder} {...field} />
				</FormControl>
				<FormDescription>
					Wird z. B. als Autor bei Textbausteinen und AI Vorlagen angezeigt.{" "}
					{USER_MESSAGES.userNameMaxLengthHint}
				</FormDescription>
				<FormMessage />
			</FormItem>
		),
		[displayNamePlaceholder],
	);

	const renderUsernameField = useCallback(
		({ field }: { field: ControllerRenderProps<ProfileFormValues, "username"> }) => (
			<FormItem>
				<FormLabel>Benutzername</FormLabel>
				<FormControl>
					<Input autoComplete="username" maxLength={30} placeholder="benutzername" {...field} />
				</FormControl>
				<FormDescription>
					Dein eindeutiger Login-Name; erscheint auch in den Links zu deinen AI Vorlagen.
					Buchstaben, Zahlen, Punkt und Unterstrich.
				</FormDescription>
				<FormMessage />
			</FormItem>
		),
		[],
	);

	const renderEmailField = useCallback(
		({ field }: { field: ControllerRenderProps<ProfileFormValues, "email"> }) => (
			<FormItem>
				<FormLabel>E-Mail</FormLabel>
				<FormControl>
					<Input placeholder={user?.email} {...field} disabled />
				</FormControl>
				<FormDescription>
					Deine E-Mail-Adresse wird zum Login verwendet und kann aktuell nicht verändert werden.
				</FormDescription>
				<FormMessage />
			</FormItem>
		),
		[user?.email],
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Profil</CardTitle>
				<CardDescription>
					Verwalten Sie Ihre persönlichen Informationen und deren Darstellung in MDScribe.
				</CardDescription>
			</CardHeader>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)}>
					<CardContent className="space-y-6">
						<FormField name="name" render={renderDisplayNameField} />
						<FormField name="username" render={renderUsernameField} />
						<FormField name="email" render={renderEmailField} />
					</CardContent>
					<CardFooter className="mt-auto">
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "Speichern..." : "Änderungen speichern"}
						</Button>
					</CardFooter>
				</form>
			</Form>
		</Card>
	);
};
