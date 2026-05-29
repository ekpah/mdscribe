"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/design-system/components/ui/select";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Eye,
	Inbox,
	Loader2,
	Mail,
	Search,
	Send,
	ShieldCheck,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/lib/orpc";

type EmailDraft = Awaited<ReturnType<typeof orpc.admin.emails.list.call>>[number];
type CategoryFilter = "all" | EmailDraft["category"];

const categoryLabels: Record<EmailDraft["category"], string> = {
	authentication: "Auth",
	marketing: "Marketing",
	transactional: "Transaktional",
};

const categoryFilterOptions: { label: string; value: CategoryFilter }[] = [
	{ label: "Alle Kategorien", value: "all" },
	{ label: "Marketing", value: "marketing" },
	{ label: "Auth", value: "authentication" },
	{ label: "Transaktional", value: "transactional" },
];

const getErrorMessage = (error: unknown, fallback: string): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (error) {
		return String(error);
	}
	return fallback;
};

export default function AdminEmailsPageClient() {
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const [selectedDraftId, setSelectedDraftId] = useState("");
	const [testRecipient, setTestRecipient] = useState("");
	const [sendDialogOpen, setSendDialogOpen] = useState(false);

	const {
		data: drafts = [],
		error: draftsError,
		isLoading: draftsLoading,
	} = useQuery(orpc.admin.emails.list.queryOptions());

	const activeDraft = useMemo(
		() =>
			drafts.find((draft) => draft.id === selectedDraftId) ??
			drafts[0] ??
			null,
		[drafts, selectedDraftId],
	);
	const activeDraftId = activeDraft?.id ?? "";

	const previewQuery = useQuery({
		...orpc.admin.emails.preview.queryOptions({
			input: { id: activeDraftId },
		}),
		enabled: Boolean(activeDraftId),
	});

	const sendTestMutation = useMutation({
		mutationFn: () =>
			orpc.admin.emails.sendTest.call({
				id: activeDraftId,
				to: testRecipient.trim(),
			}),
		onError: (error) => {
			toast.error(getErrorMessage(error, "Test-E-Mail konnte nicht gesendet werden"));
		},
		onSuccess: (result) => {
			toast.success("Test-E-Mail gesendet", {
				description: `${result.subject} an ${result.to}`,
			});
			setSendDialogOpen(false);
			setTestRecipient("");
		},
	});

	const filteredDrafts = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		return drafts.filter((draft) => {
			const matchesCategory =
				categoryFilter === "all" || draft.category === categoryFilter;
			if (!matchesCategory) {
				return false;
			}

			if (!normalizedSearch) {
				return true;
			}

			return [
				draft.title,
				draft.description,
				draft.subject,
				categoryLabels[draft.category],
			]
				.join(" ")
				.toLowerCase()
				.includes(normalizedSearch);
		});
	}, [categoryFilter, drafts, search]);

	const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSearch(event.target.value);
	}, []);

	const handleCategoryFilterChange = useCallback((value: string) => {
		setCategoryFilter(value as CategoryFilter);
	}, []);

	const handleRecipientChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setTestRecipient(event.target.value);
	}, []);

	const handleSendTest = useCallback(() => {
		if (!activeDraftId) {
			toast.error("Bitte einen E-Mail-Entwurf auswählen");
			return;
		}
		if (!testRecipient.trim()) {
			toast.error("Bitte eine Empfängeradresse eingeben");
			return;
		}

		sendTestMutation.mutate();
	}, [activeDraftId, sendTestMutation, testRecipient]);

	if (draftsLoading && drafts.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center">
					<div className="flex items-center gap-2 text-solarized-base01">
						<Loader2 className="h-5 w-5 animate-spin" />
						<span>E-Mail-Entwürfe werden geladen...</span>
					</div>
				</div>
			</div>
		);
	}

	if (draftsError && drafts.length === 0) {
		return (
			<div className="p-4 sm:p-6">
				<div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center">
					<div className="space-y-2 text-center">
						<Mail className="mx-auto h-8 w-8 text-solarized-red" />
						<h1 className="font-semibold text-lg text-solarized-base00">
							E-Mail-Entwürfe konnten nicht geladen werden
						</h1>
						<p className="text-sm text-solarized-base01">
							{getErrorMessage(draftsError, "Unbekannter Fehler")}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
							<Mail className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
								E-Mail Entwürfe
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								React-Email-Vorlagen prüfen und einzelne Test-E-Mails senden.
							</p>
						</div>
					</div>

					<Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
						<DialogTrigger asChild>
							<Button disabled={!activeDraft}>
								<Send className="h-4 w-4" />
								Test senden
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-md">
							<DialogHeader>
								<DialogTitle>Test-E-Mail senden</DialogTitle>
								<DialogDescription>
									Sendet den ausgewählten Entwurf einmalig an eine manuell
									eingegebene Adresse. Es werden keine Benutzerlisten verwendet.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-2">
								<div className="rounded-md border border-solarized-base2 bg-solarized-base3/70 p-3">
									<p className="font-medium text-sm text-solarized-base00">
										{activeDraft?.title ?? "Kein Entwurf ausgewählt"}
									</p>
									<p className="mt-1 text-solarized-base01 text-xs">
										Betreff: [TEST] {activeDraft?.subject}
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="test-recipient">Empfänger</Label>
									<Input
										id="test-recipient"
										type="email"
										placeholder="name@example.com"
										value={testRecipient}
										onChange={handleRecipientChange}
									/>
								</div>
								<div className="flex gap-2 rounded-md border border-solarized-yellow/30 bg-solarized-yellow/10 p-3 text-solarized-base01 text-xs">
									<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-solarized-yellow" />
									<p>
										Diese Aktion ist nur für Testversand gedacht. Broadcasts an
										Benutzer sind hier bewusst noch nicht verfügbar.
									</p>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setSendDialogOpen(false)}
									disabled={sendTestMutation.isPending}
								>
									Abbrechen
								</Button>
								<Button
									onClick={handleSendTest}
									disabled={sendTestMutation.isPending}
								>
									{sendTestMutation.isPending ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Send className="h-4 w-4" />
									)}
									Test-E-Mail senden
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				<div className="grid gap-4 lg:grid-cols-[360px_1fr]">
					<Card className="border-solarized-base2">
						<CardHeader>
							<CardTitle className="text-solarized-base00">Entwürfe</CardTitle>
							<CardDescription>
								{drafts.length} registrierte E-Mail-Vorlagen
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-3">
								<div className="relative">
									<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-solarized-base01" />
									<Input
										className="pl-9"
										placeholder="Entwürfe suchen..."
										value={search}
										onChange={handleSearchChange}
									/>
								</div>
								<Select
									value={categoryFilter}
									onValueChange={handleCategoryFilterChange}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{categoryFilterOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								{filteredDrafts.length === 0 ? (
									<div className="rounded-lg border border-dashed border-solarized-base2 bg-solarized-base3/60 p-4 text-sm text-solarized-base01">
										Keine Entwürfe gefunden.
									</div>
								) : (
									filteredDrafts.map((draft) => {
										const isActive = draft.id === activeDraftId;

										return (
											<button
												type="button"
												key={draft.id}
												onClick={() => setSelectedDraftId(draft.id)}
												className={cn(
													"w-full rounded-lg border p-3 text-left transition-colors",
													isActive
														? "border-solarized-blue bg-solarized-blue/10"
														: "border-solarized-base2 bg-solarized-base3/50 hover:border-solarized-blue/60",
												)}
											>
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="truncate font-medium text-sm text-solarized-base00">
															{draft.title}
														</p>
														<p className="mt-1 line-clamp-2 text-solarized-base01 text-xs">
															{draft.description}
														</p>
													</div>
													<Badge variant="outline">
														{categoryLabels[draft.category]}
													</Badge>
												</div>
												<p className="mt-2 truncate text-solarized-base01 text-xs">
													{draft.subject}
												</p>
											</button>
										);
									})
								)}
							</div>
						</CardContent>
					</Card>

					<Card className="min-w-0 border-solarized-base2">
						<CardHeader>
							<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2 text-solarized-base00">
										<Eye className="h-5 w-5 text-solarized-blue" />
										{activeDraft?.title ?? "Vorschau"}
									</CardTitle>
									<CardDescription>
										{activeDraft
											? `Betreff: ${activeDraft.subject}`
											: "Wählen Sie einen Entwurf aus."}
									</CardDescription>
								</div>
								{activeDraft ? (
									<Badge variant="outline">
										{categoryLabels[activeDraft.category]}
									</Badge>
								) : null}
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{activeDraft ? (
								<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-3">
									<p className="mb-2 font-medium text-sm text-solarized-base00">
										Vorschau-Props
									</p>
									<div className="grid gap-2 md:grid-cols-2">
										{Object.entries(activeDraft.previewProps).map(([key, value]) => (
											<div
												key={key}
												className="min-w-0 rounded-md bg-solarized-base2/70 px-3 py-2"
											>
												<p className="text-solarized-base01 text-xs">{key}</p>
												<p className="truncate font-medium text-sm text-solarized-base00">
													{value}
												</p>
											</div>
										))}
									</div>
								</div>
							) : null}

							<div className="overflow-hidden rounded-lg border border-solarized-base2 bg-white">
								{previewQuery.isLoading || previewQuery.isFetching ? (
									<div className="flex min-h-[520px] items-center justify-center text-solarized-base01">
										<Loader2 className="mr-2 h-5 w-5 animate-spin" />
										Vorschau wird gerendert...
									</div>
								) : previewQuery.error ? (
									<div className="flex min-h-[520px] items-center justify-center p-6 text-center">
										<div className="space-y-2">
											<Inbox className="mx-auto h-8 w-8 text-solarized-red" />
											<p className="font-medium text-solarized-base00">
												Vorschau konnte nicht geladen werden
											</p>
											<p className="text-sm text-solarized-base01">
												{getErrorMessage(previewQuery.error, "Unbekannter Fehler")}
											</p>
										</div>
									</div>
								) : (
									<iframe
										title="E-Mail-Vorschau"
										srcDoc={previewQuery.data?.html ?? ""}
										sandbox=""
										className="h-[720px] w-full bg-white"
									/>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
