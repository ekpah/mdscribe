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
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/lib/orpc";
import { USER_MESSAGES } from "@/lib/user-messages";

interface CredentialSummary {
	enabled: boolean;
	hasApiKey: true;
	isVerified: boolean;
	name: string;
	verifiedAt: Date;
}

type AssignedModelRole = "agent" | "audio" | "documents" | "text";

interface AssignedModelSummary {
	displayName: string;
	modelId: string;
	roles: AssignedModelRole[];
}

interface ConnectionSummary {
	available: boolean;
	connectionId: string;
	connectionName: string;
	credential: CredentialSummary | null;
	models: AssignedModelSummary[];
	protocol: string;
}

const PROTOCOL_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	"openai-compatible": "OpenAI-kompatibel",
	openrouter: "OpenRouter",
	tinfoil: "Tinfoil",
};

const MODEL_ROLE_LABELS: Record<AssignedModelRole, string> = {
	agent: USER_MESSAGES.byok.modelRoles.agent,
	audio: USER_MESSAGES.byok.modelRoles.audio,
	documents: USER_MESSAGES.byok.modelRoles.documents,
	text: USER_MESSAGES.byok.modelRoles.text,
};

// oxlint-disable-next-line complexity
const ConnectionCredentialCard = ({ connection }: { connection: ConnectionSummary }) => {
	const queryClient = useQueryClient();
	const statusKey = orpc.user.aiProviders.status.queryOptions().queryKey;
	const [apiKey, setApiKey] = useState("");
	const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
	const [name, setName] = useState(connection.credential?.name ?? connection.connectionName);

	const invalidateStatus = useCallback(
		() => queryClient.invalidateQueries({ queryKey: statusKey }),
		[queryClient, statusKey],
	);

	const saveMutation = useMutation({
		mutationFn: () =>
			orpc.user.aiProviders.save.call({
				apiKey,
				name,
				providerId: connection.connectionId,
			}),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : USER_MESSAGES.unknownError),
		onSuccess: async () => {
			setApiKey("");
			await invalidateStatus();
			toast.success(USER_MESSAGES.byok.credentialSaved);
		},
	});

	const enabledMutation = useMutation({
		mutationFn: (enabled: boolean) =>
			orpc.user.aiProviders.setEnabled.call({
				enabled,
				providerId: connection.connectionId,
			}),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : USER_MESSAGES.unknownError),
		onSuccess: async (result) => {
			await invalidateStatus();
			toast.success(
				result.enabled
					? USER_MESSAGES.byok.credentialEnabled
					: USER_MESSAGES.byok.credentialDisabled,
			);
		},
	});

	const renameMutation = useMutation({
		mutationFn: () =>
			orpc.user.aiProviders.rename.call({
				name,
				providerId: connection.connectionId,
			}),
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : USER_MESSAGES.unknownError),
		onSuccess: async () => {
			await invalidateStatus();
			toast.success(USER_MESSAGES.byok.renamed);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () =>
			orpc.user.aiProviders.delete.call({
				providerId: connection.connectionId,
			}),
		onError: (error) => {
			setIsDeleteConfirming(false);
			toast.error(error instanceof Error ? error.message : USER_MESSAGES.unknownError);
		},
		onSuccess: async () => {
			setIsDeleteConfirming(false);
			await invalidateStatus();
			toast.success(USER_MESSAGES.byok.credentialDeleted);
		},
	});

	const handleSave = useCallback(() => {
		saveMutation.mutate();
	}, [saveMutation]);
	const handleRename = useCallback(() => {
		renameMutation.mutate();
	}, [renameMutation]);
	const handleEnabledChange = useCallback(
		(enabled: boolean) => {
			enabledMutation.mutate(enabled);
		},
		[enabledMutation],
	);
	const handleDeactivate = useCallback(() => {
		enabledMutation.mutate(false);
	}, [enabledMutation]);
	const handleDelete = useCallback(() => {
		if (!isDeleteConfirming) {
			setIsDeleteConfirming(true);
			return;
		}
		deleteMutation.mutate();
	}, [deleteMutation, isDeleteConfirming]);
	const handleCancelDelete = useCallback(() => {
		setIsDeleteConfirming(false);
	}, []);

	const isPending =
		saveMutation.isPending ||
		enabledMutation.isPending ||
		renameMutation.isPending ||
		deleteMutation.isPending;

	return (
		<Card className="border-solarized-base2">
			<CardHeader>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<CardTitle>{connection.connectionName}</CardTitle>
							<Badge variant="outline">
								{PROTOCOL_LABELS[connection.protocol] ?? connection.protocol}
							</Badge>
							{connection.credential?.hasApiKey && connection.credential.isVerified && (
								<Badge className="border-solarized-green/40 bg-solarized-green/10 text-solarized-green">
									<CircleCheck className="mr-1 h-3.5 w-3.5" />
									{USER_MESSAGES.byok.verified}
								</Badge>
							)}
							{!connection.available && (
								<Badge variant="secondary">{USER_MESSAGES.byok.connectionUnavailableStatus}</Badge>
							)}
						</div>
						<CardDescription>
							{connection.credential
								? USER_MESSAGES.byok.credentialDescription
								: USER_MESSAGES.byok.emptyDescription}
						</CardDescription>
					</div>
					{connection.credential && connection.available && (
						<div className="flex items-center gap-2">
							<span className="text-solarized-base01 text-sm">
								{connection.credential.enabled
									? USER_MESSAGES.byok.active
									: USER_MESSAGES.byok.inactive}
							</span>
							<Switch
								checked={connection.credential.enabled}
								disabled={isPending}
								onCheckedChange={handleEnabledChange}
							/>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="rounded-lg border border-solarized-base2 bg-solarized-base3 p-3">
					<p className="font-medium text-sm text-solarized-base00">
						{USER_MESSAGES.byok.assignedModelsHeading}
					</p>
					<p className="mt-1 text-solarized-base01 text-xs">
						{USER_MESSAGES.byok.assignedModelsDescription}
					</p>
					{connection.models.length > 0 ? (
						<div className="mt-3 space-y-2">
							{connection.models.map((model) => (
								<div
									className="rounded-md border border-solarized-base2 bg-solarized-base3/70 p-2.5"
									key={model.modelId}
								>
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate font-medium text-sm text-solarized-base00">
												{model.displayName}
											</p>
											{model.displayName !== model.modelId && (
												<p className="break-all font-mono text-solarized-base01 text-xs">
													{model.modelId}
												</p>
											)}
										</div>
										<div className="flex flex-wrap gap-1">
											{model.roles.map((role) => (
												<Badge key={role} variant="secondary">
													{MODEL_ROLE_LABELS[role]}
												</Badge>
											))}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="mt-3 text-solarized-base01 text-sm">
							{USER_MESSAGES.byok.noAssignedModels}
						</p>
					)}
				</div>
				{connection.credential?.enabled && connection.available && (
					<div className="rounded-lg border border-solarized-green/30 bg-solarized-green/10 p-3">
						<div className="flex items-center gap-2 font-medium text-sm text-solarized-green">
							<ShieldCheck className="h-4 w-4" />
							{USER_MESSAGES.byok.unlimited}
						</div>
						<p className="mt-1 text-solarized-base01 text-xs">
							{USER_MESSAGES.byok.activeDescription}
						</p>
					</div>
				)}
				{!connection.available && (
					<p className="rounded-lg border border-solarized-yellow/30 bg-solarized-yellow/10 p-3 text-sm text-solarized-base01">
						{USER_MESSAGES.byok.unavailableDescription}
					</p>
				)}

				{connection.available && (
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor={`byok-name-${connection.connectionId}`}>
								{USER_MESSAGES.byok.displayNameLabel}
							</Label>
							<Input
								id={`byok-name-${connection.connectionId}`}
								maxLength={60}
								onChange={(event) => setName(event.target.value)}
								placeholder={USER_MESSAGES.byok.displayNamePlaceholder}
								value={name}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`byok-key-${connection.connectionId}`}>
								{USER_MESSAGES.byok.apiKeyLabel}
							</Label>
							<Input
								autoComplete="new-password"
								id={`byok-key-${connection.connectionId}`}
								maxLength={4096}
								onChange={(event) => setApiKey(event.target.value)}
								placeholder={USER_MESSAGES.byok.apiKeyPlaceholder}
								type="password"
								value={apiKey}
							/>
						</div>
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					{connection.available && (
						<Button disabled={isPending || !apiKey.trim() || !name.trim()} onClick={handleSave}>
							{saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{connection.credential ? USER_MESSAGES.byok.replace : USER_MESSAGES.byok.save}
						</Button>
					)}
					{connection.available && connection.credential && (
						<Button
							disabled={isPending || !name.trim() || name.trim() === connection.credential.name}
							onClick={handleRename}
							variant="outline"
						>
							{USER_MESSAGES.byok.rename}
						</Button>
					)}
					{!connection.available && connection.credential?.enabled && (
						<Button disabled={isPending} onClick={handleDeactivate} variant="outline">
							{USER_MESSAGES.byok.deactivate}
						</Button>
					)}
					{connection.credential && (
						<Button
							disabled={isPending}
							onClick={handleDelete}
							variant={isDeleteConfirming ? "destructive" : "outline"}
						>
							{isDeleteConfirming ? USER_MESSAGES.byok.deleteConfirm : USER_MESSAGES.byok.delete}
						</Button>
					)}
					{isDeleteConfirming && (
						<Button disabled={isPending} onClick={handleCancelDelete} variant="ghost">
							{USER_MESSAGES.byok.cancel}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export const AiAccessPage = () => {
	const { data, error, isLoading } = useQuery(orpc.user.aiProviders.status.queryOptions());
	const content = (() => {
		if (isLoading) {
			return (
				<div className="flex justify-center py-16">
					<Loader2 className="h-6 w-6 animate-spin text-solarized-base01" />
				</div>
			);
		}
		if (error) {
			return (
				<Card className="border-solarized-red/30">
					<CardContent className="p-6 text-solarized-red">
						{error instanceof Error ? error.message : USER_MESSAGES.unknownError}
					</CardContent>
				</Card>
			);
		}
		if (data?.connections.length) {
			return (
				<div className="space-y-4">
					{data.connections.map((connection) => (
						<ConnectionCredentialCard connection={connection} key={connection.connectionId} />
					))}
				</div>
			);
		}
		return (
			<Card className="border-dashed border-solarized-base2">
				<CardContent className="p-8 text-center text-solarized-base01">
					{USER_MESSAGES.byok.noConnections}
				</CardContent>
			</Card>
		);
	})();

	return (
		<div className="space-y-6">
			<div className="flex items-start gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10">
					<KeyRound className="h-5 w-5 text-solarized-blue" />
				</div>
				<div>
					<h1 className="font-bold text-2xl text-solarized-base00">{USER_MESSAGES.byok.heading}</h1>
					<p className="mt-1 text-solarized-base01 text-sm">{USER_MESSAGES.byok.intro}</p>
				</div>
			</div>

			{content}
		</div>
	);
};
