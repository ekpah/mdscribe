"use client"

import { Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "../../lib/utils"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "./select"

export interface ModelSelectorOption {
	key?: string
	value: string
	label: string
	group?: string
	keywords?: string[]
}

interface ModelSelectorProps<TOption extends ModelSelectorOption> {
	id?: string
	options: TOption[]
	value: string | null | undefined
	onValueChange: (value: string) => void
	placeholder?: string
	emptyMessage?: string
	loadingMessage?: string
	disabled?: boolean
	isLoading?: boolean
	className?: string
	popoverClassName?: string
	listClassName?: string
	formatGroupLabel?: (group: string) => string
	renderSelected?: (selected: TOption | null) => React.ReactNode
	renderOption?: (option: TOption, isSelected: boolean) => React.ReactNode
}

interface NormalizedOption<TOption extends ModelSelectorOption> {
	key: string
	option: TOption
}

export function ModelSelector<TOption extends ModelSelectorOption>({
	id,
	options,
	value,
	onValueChange,
	placeholder = "Modell auswählen...",
	emptyMessage = "Keine Modelle gefunden.",
	loadingMessage = "Lade Modelle...",
	disabled = false,
	isLoading = false,
	className,
	popoverClassName,
	listClassName,
	formatGroupLabel,
	renderSelected,
	renderOption,
}: ModelSelectorProps<TOption>) {
	const normalizedOptions = React.useMemo<NormalizedOption<TOption>[]>(() => {
		return options.map((option) => ({
			key: option.key ?? option.value,
			option,
		}))
	}, [options])

	const optionByKey = React.useMemo(() => {
		return new Map(normalizedOptions.map((entry) => [entry.key, entry.option]))
	}, [normalizedOptions])

	const firstKeyByValue = React.useMemo(() => {
		const map = new Map<string, string>()
		for (const entry of normalizedOptions) {
			if (!map.has(entry.option.value)) {
				map.set(entry.option.value, entry.key)
			}
		}
		return map
	}, [normalizedOptions])

	const selectedKey = value ? firstKeyByValue.get(value) : undefined
	const selectedOption = selectedKey ? optionByKey.get(selectedKey) ?? null : null

	const groupedOptions = React.useMemo<[string, NormalizedOption<TOption>[]][]>(
		() => {
			const groups = new Map<string, NormalizedOption<TOption>[]>()
			for (const entry of normalizedOptions) {
				const group = entry.option.group ?? ""
				const existing = groups.get(group)
				if (existing) {
					existing.push(entry)
				} else {
					groups.set(group, [entry])
				}
			}
			return Array.from(groups.entries())
		},
		[normalizedOptions]
	)

	const handleSelect = React.useCallback(
		(nextKey: string) => {
			const selected = optionByKey.get(nextKey)
			if (!selected) return
			onValueChange(selected.value)
		},
		[onValueChange, optionByKey]
	)

	return (
		<Select
			disabled={disabled || isLoading}
			onValueChange={handleSelect}
			value={selectedKey}
		>
			<SelectTrigger
				id={id}
				className={cn(
					"w-full min-w-0 text-left font-normal",
					className,
					isLoading && "cursor-wait"
				)}
			>
				{isLoading ? (
					<div className="flex items-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin" />
						<span>{loadingMessage}</span>
					</div>
				) : selectedOption ? (
					renderSelected ? (
						renderSelected(selectedOption)
					) : (
						<span className="min-w-0 truncate">{selectedOption.label}</span>
					)
				) : (
					<span className="text-muted-foreground">{placeholder}</span>
				)}
			</SelectTrigger>
			<SelectContent
				position="popper"
				className={cn("max-h-[min(60vh,24rem)]", popoverClassName)}
			>
				{groupedOptions.length === 0 ? (
					<div className="px-2 py-6 text-center text-muted-foreground text-sm">
						{emptyMessage}
					</div>
				) : (
					<div className={cn(listClassName)}>
						{groupedOptions.map(([group, entries]) => (
							<SelectGroup key={group || "__ungrouped__"}>
								{group ? (
									<SelectLabel>
										{formatGroupLabel ? formatGroupLabel(group) : group}
									</SelectLabel>
								) : null}
								{entries.map(({ key, option }) => (
									<SelectItem key={key} value={key} className="min-w-0 py-2">
										{renderOption ? (
											renderOption(option, option.value === value)
										) : (
											<span className="min-w-0 truncate">{option.label}</span>
										)}
									</SelectItem>
								))}
							</SelectGroup>
						))}
					</div>
				)}
			</SelectContent>
		</Select>
	)
}
