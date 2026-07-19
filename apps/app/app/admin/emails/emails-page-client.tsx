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
	AlertTriangle,
	Eye,
	Inbox,
	Loader2,
	Mail,
	Search,
	Send,
	ShieldCheck,
	Users,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";

type EmailDraft = Awaited<ReturnType<typeof orpc.admin.emails.list.call>>[number];
type EmailTestRecipient = Awaited<
	ReturnType<typeof orpc.admin.emails.listTestRecipients.call>
>[number];
type CategoryFilter = "all" | EmailDraft["category"];

const MARKETING_BROADCAST_CONFIRMATION = "MARKETING E-MAIL SENDEN";

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

const formatTestRecipientLabel = (recipient: EmailTestRecipient): string => {
	const name = recipient.name?.trim();
	if (name) {
		return `${name} · ${recipient.email}`;
	}

	return recipient.email;
};

const EmailPreviewFrame = ({
	error,
	html,
	isLoading,
}: {
	error: unknown;
	html: string;
	isLoading: boolean;
}) => {
	if (isLoading) {
		return (
			<div className="flex min-h-[520px] items-center justify-center text-solarized-base01">
				<Loader2 className="mr-2 h-5 w-5 animate-spin" />
				Vorschau wird gerendert...
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-[520px] items-center justify-center p-6 text-center">
				<div className="space-y-2">
					<Inbox className="mx-auto h-8 w-8 text-solarized-red" />
					<p className="font-medium text-solarized-base00">Vorschau konnte nicht geladen werden</p>
					<p className="text-sm text-solarized-base01">
						{getErrorMessage(error, "Unbekannter Fehler")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<iframe
			className="h-[720px] w-full bg-white"
			sandbox=""
			srcDoc={html}
			title="E-Mail-Vorschau"
		/>
	);
};

const filterEmailDrafts = (
	drafts: EmailDraft[],
	categoryFilter: CategoryFilter,
	search: string,
) => {
	const normalizedSearch = search.trim().toLowerCase();
	return drafts.filter((draft) => {
		const matchesCategory = categoryFilter === "all" || draft.category === categoryFilter;
		if (matchesCategory) {
			if (normalizedSearch) {
				return [draft.title, draft.description, draft.subject, categoryLabels[draft.category]]
					.join(" ")
					.toLowerCase()
					.includes(normalizedSearch);
			}
			return true;
		}

		return false;
	});
};

const AdminEmailsLoadingState = () => (
	<div className="p-4 sm:p-6">
		<div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center">
			<div className="flex items-center gap-2 text-solarized-base01">
				<Loader2 className="h-5 w-5 animate-spin" />
				<span>E-Mail-Entwürfe werden geladen...</span>
			</div>
		</div>
	</div>
);

const AdminEmailsErrorState = ({ error }: { error: unknown }) => (
	<div className="p-4 sm:p-6">
		<div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center">
			<div className="space-y-2 text-center">
				<Mail className="mx-auto h-8 w-8 text-solarized-red" />
				<h1 className="font-semibold text-lg text-solarized-base00">
					E-Mail-Entwürfe konnten nicht geladen werden
				</h1>
				<p className="text-sm text-solarized-base01">
					{getErrorMessage(error, "Unbekannter Fehler")}
				</p>
			</div>
		</div>
	</div>
);

const SendTestDialog = ({
	activeDraft,
	isPending,
	isUsersLoading,
	onOpenChange,
	onSendTest,
	onUserChange,
	open,
	selectedUserId,
	users,
	usersError,
}: {
	activeDraft: EmailDraft | null;
	isPending: boolean;
	isUsersLoading: boolean;
	onOpenChange: (open: boolean) => void;
	onSendTest: () => void;
	onUserChange: (userId: string) => void;
	open: boolean;
	selectedUserId: string;
	users: EmailTestRecipient[];
	usersError: unknown;
}) => {
	const selectedUser = users.find((recipient) => recipient.id === selectedUserId) ?? null;
	const canSend = Boolean(activeDraft && selectedUserId && !isUsersLoading && !usersError);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger render={<Button disabled={!activeDraft}>
					<Send className="h-4 w-4" />
					Test senden
				</Button>} />
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Test-E-Mail senden</DialogTitle>
					<DialogDescription>
						Sendet den ausgewählten Entwurf einmalig an einen Nutzer und rendert
						nutzerbezogene Variablen mit dessen Profil.
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
						<Label htmlFor="test-user">Empfänger</Label>
						<Select
							value={selectedUserId}
							onValueChange={onUserChange}
							disabled={isUsersLoading || Boolean(usersError) || users.length === 0}
						>
							<SelectTrigger id="test-user">
								<SelectValue
									placeholder={
										isUsersLoading ? "Nutzer werden geladen..." : "Nutzer auswählen"
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{users.map((recipient) => (
									<SelectItem key={recipient.id} value={recipient.id}>
										{formatTestRecipientLabel(recipient)}
										{recipient.emailVerified ? "" : " · unverifiziert"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{usersError ? (
							<p className="text-solarized-red text-xs">
								{getErrorMessage(usersError, "Nutzer konnten nicht geladen werden")}
							</p>
						) : null}
						{selectedUser ? (
							<p className="text-solarized-base01 text-xs">
								Personalisierung:{" "}
								{selectedUser.name?.trim()
									? `Hallo ${selectedUser.name.trim()},`
									: "Hallo,"}
							</p>
						) : null}
					</div>
					<div className="flex gap-2 rounded-md border border-solarized-yellow/30 bg-solarized-yellow/10 p-3 text-solarized-base01 text-xs">
						<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-solarized-yellow" />
						<p>
							Diese Aktion sendet nur an den ausgewählten Nutzer. Marketing-Broadcasts
							laufen über die separate Aktion mit Bestätigung.
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
						Abbrechen
					</Button>
					<Button onClick={onSendTest} disabled={isPending || !canSend}>
						{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
						Test-E-Mail senden
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const SendMarketingBroadcastDialog = ({
	activeDraft,
	confirmation,
	isPending,
	onConfirmationChange,
	onOpenChange,
	onSendBroadcast,
	open,
}: {
	activeDraft: EmailDraft | null;
	confirmation: string;
	isPending: boolean;
	onConfirmationChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onOpenChange: (open: boolean) => void;
	onSendBroadcast: () => void;
	open: boolean;
}) => {
	const isMarketingDraft = activeDraft?.category === "marketing";
	const canSend = isMarketingDraft && confirmation.trim() === MARKETING_BROADCAST_CONFIRMATION;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger render={<Button variant="destructive" disabled={!isMarketingDraft}>
					<Users className="h-4 w-4" />
					An alle senden
				</Button>} />
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Marketing-E-Mail versenden</DialogTitle>
					<DialogDescription>
						Sendet den ausgewählten Marketing-Entwurf per Postmark Batch an alle
						verifizierten Nutzerkonten.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-2">
					<div className="rounded-md border border-solarized-base2 bg-solarized-base3/70 p-3">
						<p className="font-medium text-sm text-solarized-base00">
							{activeDraft?.title ?? "Kein Entwurf ausgewählt"}
						</p>
						<p className="mt-1 text-solarized-base01 text-xs">
							Betreff: {activeDraft?.subject}
						</p>
					</div>
					<div className="flex gap-2 rounded-md border border-solarized-red/30 bg-solarized-red/10 p-3 text-solarized-base01 text-xs">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-solarized-red" />
						<p>
							Diese Aktion versendet echte E-Mails. Prüfen Sie vorher die Vorschau und senden
							Sie eine Test-E-Mail.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="broadcast-confirmation">
							Bestätigung: {MARKETING_BROADCAST_CONFIRMATION}
						</Label>
						<Input
							id="broadcast-confirmation"
							placeholder={MARKETING_BROADCAST_CONFIRMATION}
							value={confirmation}
							onChange={onConfirmationChange}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
						Abbrechen
					</Button>
					<Button variant="destructive" onClick={onSendBroadcast} disabled={isPending || !canSend}>
						{isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Users className="h-4 w-4" />
						)}
						An alle verifizierten Nutzer senden
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const EmailDraftList = ({
	activeDraftId,
	categoryFilter,
	drafts,
	filteredDrafts,
	onCategoryFilterChange,
	onSearchChange,
	onSelectDraft,
	search,
}: {
	activeDraftId: string;
	categoryFilter: CategoryFilter;
	drafts: EmailDraft[];
	filteredDrafts: EmailDraft[];
	onCategoryFilterChange: (value: string) => void;
	onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onSelectDraft: (id: string) => void;
	search: string;
}) => (
	<Card className="border-solarized-base2">
		<CardHeader>
			<CardTitle className="text-solarized-base00">Entwürfe</CardTitle>
			<CardDescription>{drafts.length} registrierte E-Mail-Vorlagen</CardDescription>
		</CardHeader>
		<CardContent className="space-y-4">
			<div className="space-y-3">
				<div className="relative">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-solarized-base01" />
					<Input
						className="pl-9"
						placeholder="Entwürfe suchen..."
						value={search}
						onChange={onSearchChange}
					/>
				</div>
				<Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
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
								onClick={() => onSelectDraft(draft.id)}
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
									<Badge variant="outline">{categoryLabels[draft.category]}</Badge>
								</div>
								<p className="mt-2 truncate text-solarized-base01 text-xs">{draft.subject}</p>
							</button>
						);
					})
				)}
			</div>
		</CardContent>
	</Card>
);

const EmailPreviewCard = ({
	activeDraft,
	error,
	html,
	isLoading,
}: {
	activeDraft: EmailDraft | null;
	error: unknown;
	html: string;
	isLoading: boolean;
}) => (
	<Card className="min-w-0 border-solarized-base2">
		<CardHeader>
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<CardTitle className="flex items-center gap-2 text-solarized-base00">
						<Eye className="h-5 w-5 text-solarized-blue" />
						{activeDraft?.title ?? "Vorschau"}
					</CardTitle>
					<CardDescription>
						{activeDraft ? `Betreff: ${activeDraft.subject}` : "Wählen Sie einen Entwurf aus."}
					</CardDescription>
				</div>
				{activeDraft ? (
					<Badge variant="outline">{categoryLabels[activeDraft.category]}</Badge>
				) : null}
			</div>
		</CardHeader>
		<CardContent className="space-y-4">
			{activeDraft ? (
				<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-3">
					<p className="mb-2 font-medium text-sm text-solarized-base00">Vorschau-Props</p>
					<div className="grid gap-2 md:grid-cols-2">
						{Object.entries(activeDraft.previewProps).map(([key, value]) => (
							<div key={key} className="min-w-0 rounded-md bg-solarized-base2/70 px-3 py-2">
								<p className="text-solarized-base01 text-xs">{key}</p>
								<p className="truncate font-medium text-sm text-solarized-base00">{value}</p>
							</div>
						))}
					</div>
				</div>
			) : null}

			<div className="overflow-hidden rounded-lg border border-solarized-base2 bg-white">
				<EmailPreviewFrame error={error} html={html} isLoading={isLoading} />
			</div>
		</CardContent>
	</Card>
);

export default function AdminEmailsPageClient() {
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const [selectedDraftId, setSelectedDraftId] = useState("");
	const [selectedTestUserId, setSelectedTestUserId] = useState("");
	const [broadcastConfirmation, setBroadcastConfirmation] = useState("");
	const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
	const [sendDialogOpen, setSendDialogOpen] = useState(false);

	const {
		data: drafts = [],
		error: draftsError,
		isLoading: draftsLoading,
	} = useQuery(orpc.admin.emails.list.queryOptions());

	const {
		data: testRecipients = [],
		error: testRecipientsError,
		isLoading: testRecipientsLoading,
	} = useQuery(orpc.admin.emails.listTestRecipients.queryOptions());

	const activeDraft = useMemo(
		() => drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0] ?? null,
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
				userId: selectedTestUserId,
			}),
		onError: (error) => {
			toast.error(getErrorMessage(error, "Test-E-Mail konnte nicht gesendet werden"));
		},
		onSuccess: (result) => {
			toast.success("Test-E-Mail gesendet", {
				description: `${result.subject} an ${result.to}`,
			});
			setSendDialogOpen(false);
			setSelectedTestUserId("");
		},
	});

	const sendMarketingBroadcastMutation = useMutation({
		mutationFn: () =>
			orpc.admin.emails.sendMarketingEmail.call({
				confirmation: broadcastConfirmation.trim(),
				id: activeDraftId,
			}),
		onError: (error) => {
			toast.error(getErrorMessage(error, "E-Mail-Broadcast konnte nicht gesendet werden"));
		},
		onSuccess: (result) => {
			toast.success("E-Mail-Broadcast angestoßen", {
				description: `${result.submittedCount} von ${result.recipientCount} Empfängern in ${result.batchCount} Postmark-Batches übergeben.`,
			});
			setBroadcastDialogOpen(false);
			setBroadcastConfirmation("");
		},
	});

	const filteredDrafts = useMemo(
		() => filterEmailDrafts(drafts, categoryFilter, search),
		[categoryFilter, drafts, search],
	);

	const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setSearch(event.target.value);
	}, []);

	const handleCategoryFilterChange = useCallback((value: string) => {
		setCategoryFilter(value as CategoryFilter);
	}, []);

	const handleTestUserChange = useCallback((userId: string) => {
		setSelectedTestUserId(userId);
	}, []);

	const handleBroadcastConfirmationChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setBroadcastConfirmation(event.target.value);
		},
		[],
	);

	const handleSendTest = useCallback(() => {
		if (!activeDraftId) {
			toast.error("Bitte einen E-Mail-Entwurf auswählen");
			return;
		}
		if (!selectedTestUserId) {
			toast.error("Bitte einen Nutzer auswählen");
			return;
		}

		sendTestMutation.mutate();
	}, [activeDraftId, selectedTestUserId, sendTestMutation]);

	const handleSendMarketingBroadcast = useCallback(() => {
		if (activeDraft?.category !== "marketing") {
			toast.error("Bitte einen Marketing-E-Mail-Entwurf auswählen");
			return;
		}
		if (broadcastConfirmation.trim() !== MARKETING_BROADCAST_CONFIRMATION) {
			toast.error("Bestätigung stimmt nicht mit dem erwarteten Text überein");
			return;
		}

		sendMarketingBroadcastMutation.mutate();
	}, [activeDraft?.category, broadcastConfirmation, sendMarketingBroadcastMutation]);

	if (draftsLoading && drafts.length === 0) {
		return <AdminEmailsLoadingState />;
	}

	if (draftsError && drafts.length === 0) {
		return <AdminEmailsErrorState error={draftsError} />;
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
								React-Email-Vorlagen prüfen, Test-E-Mails senden und Marketing-Broadcasts
								auslösen.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						<SendTestDialog
							activeDraft={activeDraft}
							isPending={sendTestMutation.isPending}
							isUsersLoading={testRecipientsLoading}
							onOpenChange={setSendDialogOpen}
							onSendTest={handleSendTest}
							onUserChange={handleTestUserChange}
							open={sendDialogOpen}
							selectedUserId={selectedTestUserId}
							users={testRecipients}
							usersError={testRecipientsError}
						/>
						<SendMarketingBroadcastDialog
							activeDraft={activeDraft}
							confirmation={broadcastConfirmation}
							isPending={sendMarketingBroadcastMutation.isPending}
							onConfirmationChange={handleBroadcastConfirmationChange}
							onOpenChange={setBroadcastDialogOpen}
							onSendBroadcast={handleSendMarketingBroadcast}
							open={broadcastDialogOpen}
						/>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[360px_1fr]">
					<EmailDraftList
						activeDraftId={activeDraftId}
						categoryFilter={categoryFilter}
						drafts={drafts}
						filteredDrafts={filteredDrafts}
						onCategoryFilterChange={handleCategoryFilterChange}
						onSearchChange={handleSearchChange}
						onSelectDraft={setSelectedDraftId}
						search={search}
					/>
					<EmailPreviewCard
						activeDraft={activeDraft}
						error={previewQuery.error}
						html={previewQuery.data?.html ?? ""}
						isLoading={previewQuery.isLoading || previewQuery.isFetching}
					/>
				</div>
			</div>
		</div>
	);
}
