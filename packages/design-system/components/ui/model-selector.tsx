"use client"

import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "../../lib/utils"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "./command"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

const compareSelectorText = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
}).compare

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
	searchPlaceholder?: string
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
	searchPlaceholder = "Modell suchen...",
	className,
	popoverClassName,
	listClassName,
	formatGroupLabel,
	renderSelected,
	renderOption,
}: ModelSelectorProps<TOption>) {
	const [isOpen, setIsOpen] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState("")
	const searchInputRef = React.useRef<HTMLInputElement | null>(null)

	const normalizedOptions = React.useMemo<NormalizedOption<TOption>[]>(() => {
		return options.map((option) => ({
			key: option.key ?? option.value,
			option,
		}))
	}, [options])

	const deferredSearchQuery = React.useDeferredValue(searchQuery)
	const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()

	const filteredOptions = React.useMemo(() => {
		if (!normalizedSearchQuery) {
			return normalizedOptions
		}

		return normalizedOptions.filter(({ option }) => {
			const haystacks = [
				option.label,
				option.group,
				...(option.keywords ?? []),
			]

			return haystacks.some((entry) =>
				entry?.toLowerCase().includes(normalizedSearchQuery)
			)
		})
	}, [normalizedOptions, normalizedSearchQuery])

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
			for (const entry of filteredOptions) {
				const group = entry.option.group ?? ""
				const existing = groups.get(group)
				if (existing) {
					existing.push(entry)
				} else {
					groups.set(group, [entry])
				}
			}

			return Array.from(groups.entries())
				.map(([group, entries]) => [
					group,
					[...entries].sort((a, b) => {
						const labelCompare = compareSelectorText(
							a.option.label,
							b.option.label
						)
						if (labelCompare !== 0) {
							return labelCompare
						}

						return compareSelectorText(a.key, b.key)
					}),
				] as const)
				.sort(([groupA], [groupB]) => {
					if (!groupA && groupB) {
						return 1
					}
					if (groupA && !groupB) {
						return -1
					}

					const labelA = formatGroupLabel ? formatGroupLabel(groupA) : groupA
					const labelB = formatGroupLabel ? formatGroupLabel(groupB) : groupB
					return compareSelectorText(labelA, labelB)
				})
		},
		[filteredOptions, formatGroupLabel]
	)

	const handleSelect = React.useCallback(
		(nextKey: string) => {
			const selected = optionByKey.get(nextKey)
			if (!selected) return
			setIsOpen(false)
			setSearchQuery("")
			onValueChange(selected.value)
		},
		[onValueChange, optionByKey]
	)

	const handleOpenChange = React.useCallback((open: boolean) => {
		setIsOpen(open)
		if (!open) {
			setSearchQuery("")
		}
	}, [])

	React.useEffect(() => {
		if (!isOpen) return

		const focusHandle = window.setTimeout(() => {
			const searchInput = searchInputRef.current
			if (!searchInput) return
			searchInput.focus()
			searchInput.select()
		}, 0)

		return () => window.clearTimeout(focusHandle)
	}, [isOpen])

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					role="combobox"
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					className={cn(
						"border-input text-foreground data-[placeholder]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex min-h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
						className,
						isLoading && "cursor-wait"
					)}
					disabled={disabled || isLoading}
				>
					<div className="min-w-0 flex-1 text-left">
						{isLoading ? (
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								<span>{loadingMessage}</span>
							</div>
						) : selectedOption ? (
							renderSelected ? (
								renderSelected(selectedOption)
							) : (
								<span className="block min-w-0 truncate">
									{selectedOption.label}
								</span>
							)
						) : (
							<span className="block text-muted-foreground">{placeholder}</span>
						)}
					</div>
					<ChevronsUpDown className="text-muted-foreground h-4 w-4 shrink-0 opacity-70" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="start"
				sideOffset={8}
				collisionPadding={12}
				sticky="always"
				className={cn(
					"w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-1rem)] overflow-hidden p-0 shadow-lg",
					popoverClassName
				)}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<Command shouldFilter={false} className="bg-popover">
					<CommandInput
						ref={searchInputRef}
						autoFocus={isOpen}
						value={searchQuery}
						onValueChange={setSearchQuery}
						placeholder={searchPlaceholder}
						className="h-10"
					/>
					<CommandList
						className={cn(
							"max-h-[min(22rem,calc(var(--radix-popover-content-available-height)-3.5rem))] overflow-x-hidden overflow-y-auto overscroll-contain",
							listClassName
						)}
					>
						{groupedOptions.length === 0 ? (
							<CommandEmpty>{emptyMessage}</CommandEmpty>
						) : (
							groupedOptions.map(([group, entries]) => (
								<CommandGroup
									key={group || "__ungrouped__"}
									heading={
										group
											? formatGroupLabel
												? formatGroupLabel(group)
												: group
											: undefined
									}
								>
									{entries.map(({ key, option }) => {
										const isSelected = key === selectedKey

										return (
											<CommandItem
												key={key}
												value={key}
												onSelect={handleSelect}
												className="gap-3 px-3 py-2"
											>
												<div className="min-w-0 flex-1">
													{renderOption ? (
														renderOption(option, isSelected)
													) : (
														<span className="block min-w-0 truncate">
															{option.label}
														</span>
													)}
												</div>
												<Check
													className={cn(
														"h-4 w-4 shrink-0",
														isSelected ? "opacity-100" : "opacity-0"
													)}
												/>
											</CommandItem>
										)
									})}
								</CommandGroup>
							))
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
