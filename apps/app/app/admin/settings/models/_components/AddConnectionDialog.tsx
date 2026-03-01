"use client";

import { Button } from "@repo/design-system/components/ui/button";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	normalizeProviderBaseUrl,
	PROVIDER_BASE_URL_ERROR_MESSAGE,
} from "@/lib/openai-compatible";
import { orpc } from "@/lib/orpc";

const PROTOCOLS = [
	{
		value: "openai-compatible",
		label: "OpenAI-kompatibel (llama.cpp / vLLM / LM Studio)",
	},
	{ value: "openrouter", label: "OpenRouter" },
	{ value: "openai", label: "OpenAI" },
	{ value: "anthropic", label: "Anthropic" },
] as const;

function normalizeMaybeBaseUrl(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return normalizeProviderBaseUrl(trimmed);
}

export function AddProviderDialog() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [protocol, setProtocol] = useState<string>("openai-compatible");
	const [baseUrl, setBaseUrl] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [validated, setValidated] = useState(false);

	const queryClient = useQueryClient();
	const listKey = orpc.admin.providers.connections.list.queryOptions().queryKey;

	const providerPayload = useMemo(() => {
		let normalizedBaseUrl: string | undefined;
		if (baseUrl.trim()) {
			normalizedBaseUrl = normalizeMaybeBaseUrl(baseUrl);
		}

		return {
			name: name.trim(),
			protocol: protocol as
				| "openai-compatible"
				| "openrouter"
				| "openai"
				| "anthropic",
			baseUrl: normalizedBaseUrl,
			apiKey: apiKey.trim() || undefined,
		};
	}, [name, protocol, baseUrl, apiKey]);

	const handleReset = () => {
		setName("");
		setProtocol("openai-compatible");
		setBaseUrl("");
		setApiKey("");
		setValidated(false);
		setOpen(false);
	};

	const checkMutation = useMutation({
		mutationFn: () =>
			orpc.admin.providers.connections.previewModels.call({
				protocol: providerPayload.protocol,
				baseUrl: providerPayload.baseUrl,
				apiKey: providerPayload.apiKey,
			}),
		onSuccess: (data) => {
			setValidated(true);
			toast.success("Provider validiert", {
				description: `${data.models.length} Modelle gefunden`,
			});
		},
		onError: (error) => {
			setValidated(false);
			toast.error(
				error instanceof Error ? error.message : "Validierung fehlgeschlagen",
			);
		},
	});

	const createMutation = useMutation({
		mutationFn: () =>
			orpc.admin.providers.connections.create.call({
				name: providerPayload.name,
				protocol: providerPayload.protocol,
				baseUrl: providerPayload.baseUrl,
				apiKey: providerPayload.apiKey,
			}),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({ queryKey: listKey });
			toast.success("Provider erstellt", {
				description: `${result.modelCount} Modelle synchronisiert`,
			});
			handleReset();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Fehler beim Erstellen",
			);
			},
		});

	const handleFieldChange = (
		setter: (value: string) => void,
		value: string,
	) => {
		setter(value);
		setValidated(false);
	};

	const handleCheck = () => {
		if (!providerPayload.name) {
			toast.error("Bitte einen Namen eingeben");
			return;
		}
		if (
			providerPayload.protocol === "openai-compatible" &&
			!providerPayload.baseUrl
		) {
			toast.error(
				"OpenAI-kompatible Provider benoetigen eine Base URL (inkl. /v1)",
			);
			return;
		}

		try {
			if (baseUrl.trim()) {
				normalizeMaybeBaseUrl(baseUrl);
			}
		} catch {
			toast.error(PROVIDER_BASE_URL_ERROR_MESSAGE);
			return;
		}

		checkMutation.mutate();
	};

	const handleCreate = () => {
		if (!validated) {
			toast.error("Bitte zuerst die Verbindung prüfen");
			return;
		}
		createMutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus className="mr-1.5 h-4 w-4" />
					Provider hinzufügen
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Neuer Provider</DialogTitle>
					<DialogDescription>
						Erst prüfen, dann speichern. Beim Erstellen werden alle Modelle
						synchronisiert.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="provider-name">Name</Label>
						<Input
							id="provider-name"
							placeholder="z.B. OpenRouter oder Local llama.cpp"
							value={name}
							onChange={(event) =>
								handleFieldChange(setName, event.target.value)
							}
						/>
					</div>

					<div className="space-y-2">
						<Label>Protokoll</Label>
						<Select
							value={protocol}
							onValueChange={(value) => handleFieldChange(setProtocol, value)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PROTOCOLS.map((entry) => (
									<SelectItem key={entry.value} value={entry.value}>
										{entry.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="provider-url">
							Base URL
							{protocol === "openai-compatible"
								? " (erforderlich)"
								: " (optional)"}
						</Label>
						<Input
							id="provider-url"
							placeholder={
								protocol === "openai-compatible"
									? "http://localhost:11434/v1"
									: "https://api.openai.com/v1"
							}
							value={baseUrl}
							onChange={(event) =>
								handleFieldChange(setBaseUrl, event.target.value)
							}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="provider-key">API Key (optional)</Label>
						<Input
							id="provider-key"
							type="password"
							placeholder="sk-..."
							value={apiKey}
							onChange={(event) =>
								handleFieldChange(setApiKey, event.target.value)
							}
						/>
					</div>

					{validated && (
						<div className="flex items-center gap-2 rounded-md border border-solarized-green/30 bg-solarized-green/10 px-3 py-2 text-sm text-solarized-green">
							<CheckCircle2 className="h-4 w-4" />
							Verbindung geprüft. Erstellung freigegeben.
						</div>
					)}
				</div>

				<DialogFooter className="gap-2">
					<Button variant="outline" onClick={handleReset}>
						Abbrechen
					</Button>
					<Button
						variant="secondary"
						onClick={handleCheck}
						disabled={checkMutation.isPending || createMutation.isPending}
					>
						{checkMutation.isPending && (
							<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
						)}
						Verbindung prüfen
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!validated || createMutation.isPending}
					>
						{createMutation.isPending && (
							<Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
						)}
						Erstellen
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// Backward-compatible export during migration of import sites.
export { AddProviderDialog as AddConnectionDialog };
