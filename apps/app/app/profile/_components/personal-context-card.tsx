"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import { PERSONAL_CONTEXT_MAX_LENGTH } from "@/lib/personal-context";

const PLACEHOLDER = `z. B.
- Ich arbeite in der Kardiologie.
- Schreibe "Pat." statt "Patient".
- Diagnosen und Medikation als Aufzählung, Verlauf als Fließtext.
- Laborwerte immer mit Einheit.`;

export const PersonalContextCard = () => {
	const queryClient = useQueryClient();
	const queryOptions = orpc.user.personalContext.get.queryOptions();
	const { data, isLoading } = useQuery(queryOptions);
	// `null` until the user edits, so the saved value shows once it loads.
	const [draft, setDraft] = useState<string | null>(null);
	const savedValue = data?.personalContext ?? "";
	const value = draft ?? savedValue;

	const updateMutation = useMutation(
		orpc.user.personalContext.update.mutationOptions({
			onError: () => {
				toast.error("Persönlicher Kontext konnte nicht gespeichert werden");
			},
			onSuccess: (result) => {
				queryClient.setQueryData(queryOptions.queryKey, result);
				setDraft(null);
				toast.success("Persönlicher Kontext gespeichert");
			},
		}),
	);

	const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
		setDraft(event.target.value);
	}, []);
	const handleSave = useCallback(() => {
		updateMutation.mutate({ personalContext: value });
	}, [updateMutation, value]);

	const isDirty = value.trim() !== savedValue.trim();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Persönlicher Kontext</CardTitle>
				<CardDescription>
					Wird bei jeder AI-Scribe Generierung und im Dokumentations-Agenten mitgesendet, damit
					Texte Ihren Präferenzen folgen. Bitte keine Patientendaten eintragen.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<Label className="sr-only" htmlFor="personal-context">
					Persönlicher Kontext
				</Label>
				<Textarea
					className="min-h-40"
					disabled={isLoading}
					id="personal-context"
					maxLength={PERSONAL_CONTEXT_MAX_LENGTH}
					onChange={handleChange}
					placeholder={PLACEHOLDER}
					value={value}
				/>
				<div className="flex items-center justify-between gap-3">
					<span className="text-solarized-base01 text-xs">
						{value.length} / {PERSONAL_CONTEXT_MAX_LENGTH} Zeichen
					</span>
					<Button disabled={!isDirty || updateMutation.isPending} onClick={handleSave}>
						{updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
						Speichern
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
