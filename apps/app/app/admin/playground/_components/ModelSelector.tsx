"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@repo/design-system/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import {
	AudioLines,
	Check,
	ChevronsUpDown,
	FileText,
	ImageIcon,
	Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PlaygroundModel } from "../_lib/types";

interface ModelSelectorProps {
	models: PlaygroundModel[];
	isLoading?: boolean;
	selectedModel: PlaygroundModel | null;
	onSelect: (model: PlaygroundModel) => void;
	disabled?: boolean;
}

export function ModelSelector({
	models,
	isLoading,
	selectedModel,
	onSelect,
	disabled,
}: ModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	// Group models by provider
	const groupedModels = useMemo(() => {
		const groups: Record<string, PlaygroundModel[]> = {};
		for (const model of models) {
			const provider = model.id.split("/")[0] || "other";
			if (!groups[provider]) {
				groups[provider] = [];
			}
			groups[provider].push(model);
		}
		return groups;
	}, [models]);

	// Filter models by search
	const filteredGroups = useMemo(() => {
		if (!search) return groupedModels;

		const searchLower = search.toLowerCase();
		const filtered: Record<string, PlaygroundModel[]> = {};

		for (const [provider, providerModels] of Object.entries(groupedModels)) {
			const matchingModels = providerModels.filter(
				(m) =>
					m.name.toLowerCase().includes(searchLower) ||
					m.id.toLowerCase().includes(searchLower),
			);
			if (matchingModels.length > 0) {
				filtered[provider] = matchingModels;
			}
		}

		return filtered;
	}, [groupedModels, search]);

	// Format provider name
	const formatProvider = (provider: string) => {
		const names: Record<string, string> = {
			anthropic: "Anthropic",
			openai: "OpenAI",
			google: "Google",
			"meta-llama": "Meta Llama",
			mistralai: "Mistral AI",
			cohere: "Cohere",
			deepseek: "DeepSeek",
			qwen: "Qwen",
			"x-ai": "xAI",
			"z-ai": "Zhipu AI",
		};
		return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					disabled={disabled || isLoading}
					className="w-full justify-between border-solarized-base2 bg-solarized-base3 text-left font-normal hover:bg-solarized-base2"
				>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span>Lade Modelle...</span>
						</div>
					) : selectedModel ? (
						<div className="flex items-center gap-2 truncate">
							<span className="truncate">{selectedModel.name}</span>
							<div className="flex gap-1">
								{selectedModel.capabilities.supportsImage && (
									<ImageIcon className="h-3 w-3 text-solarized-blue" />
								)}
								{selectedModel.capabilities.supportsAudio && (
									<AudioLines className="h-3 w-3 text-solarized-green" />
								)}
							</div>
						</div>
					) : (
						<span className="text-solarized-base01">Modell auswählen...</span>
					)}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[400px] p-0"
				align="start"
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Modell suchen..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList className="max-h-[400px]">
						<CommandEmpty>Keine Modelle gefunden.</CommandEmpty>
						{Object.entries(filteredGroups).map(([provider, providerModels]) => (
							<CommandGroup key={provider} heading={formatProvider(provider)}>
								{providerModels.map((model) => (
									<CommandItem
										key={model.id}
										value={model.id}
										onSelect={() => {
											onSelect(model);
											setOpen(false);
											setSearch("");
										}}
										className="flex items-start gap-2 py-2"
									>
										<Check
											className={cn(
												"mt-0.5 h-4 w-4 shrink-0",
												selectedModel?.id === model.id
													? "opacity-100"
													: "opacity-0",
											)}
										/>
										<div className="flex flex-1 flex-col gap-1 overflow-hidden">
											<div className="flex items-center gap-2">
												<span className="truncate font-medium">
													{model.name}
												</span>
											</div>
											<div className="flex flex-wrap items-center gap-1 text-xs text-solarized-base01">
												<Badge
													variant="outline"
													className="h-5 px-1.5 text-[10px]"
												>
													{(model.context_length / 1000).toFixed(0)}k ctx
												</Badge>
												{model.capabilities.supportsImage && (
													<Badge
														variant="outline"
														className="h-5 gap-1 px-1.5 text-[10px] text-solarized-blue"
													>
														<ImageIcon className="h-2.5 w-2.5" />
														Bild
													</Badge>
												)}
												{model.capabilities.supportsAudio && (
													<Badge
														variant="outline"
														className="h-5 gap-1 px-1.5 text-[10px] text-solarized-green"
													>
														<AudioLines className="h-2.5 w-2.5" />
														Audio
													</Badge>
												)}
												{(model.id.includes("claude") || model.id.includes("gemini")) && (
													<Badge
														variant="outline"
														className="h-5 gap-1 px-1.5 text-[10px] text-solarized-violet"
													>
														<FileText className="h-2.5 w-2.5" />
														PDF
													</Badge>
												)}
												<span className="ml-1 text-[10px] text-solarized-base01">
													${Number.parseFloat(model.pricing.prompt).toFixed(6)}/1k
												</span>
											</div>
										</div>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
