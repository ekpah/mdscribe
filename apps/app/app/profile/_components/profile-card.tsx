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
import { useCallback, useEffect } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { USER_MESSAGES } from "@/lib/user-messages";

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
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileCardProps {
	user: {
		email: string;
		name: string | null;
	};
	isLoading: boolean;
	setIsLoading: (value: boolean) => void;
}

export const ProfileCard = ({ user, isLoading, setIsLoading }: ProfileCardProps) => {
	const userNamePlaceholder = user.email.split("@")[0] || user.email;
	const form = useForm<ProfileFormValues>({
		defaultValues: {
			email: "",
			name: "",
		},
		resolver: zodResolver(profileFormSchema),
	});

	useEffect(() => {
		if (user) {
			form.reset({
				email: user.email || "",
				name: user.name ?? "",
			});
		}
	}, [user, form]);

	const onSubmit = useCallback(
		(data: ProfileFormValues) => {
			setIsLoading(true);
			toast.promise(
				authClient.updateUser({
					name: data.name.trim(),
				}),
				{
					error: "Dein Profil konnte nicht aktualisiert werden. Bitte versuche es erneut.",
					finally: () => setIsLoading(false),
					loading: "Dein Profil wird aktualisiert...",
					success: "Dein Profil wurde erfolgreich aktualisiert.",
				},
			);
		},
		[setIsLoading],
	);

	const renderNameField = useCallback(
		({ field }: { field: ControllerRenderProps<ProfileFormValues, "name"> }) => (
			<FormItem>
				<FormLabel>Benutzername</FormLabel>
				<FormControl>
					<Input maxLength={30} placeholder={userNamePlaceholder} {...field} />
				</FormControl>
				<FormDescription>
					{USER_MESSAGES.userNameFallbackHint} {USER_MESSAGES.userNameMaxLengthHint}
				</FormDescription>
				<FormMessage />
			</FormItem>
		),
		[userNamePlaceholder],
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
						<FormField name="name" render={renderNameField} />
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
