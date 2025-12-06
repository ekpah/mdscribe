"use client";

import { Kbd } from "@repo/design-system/components/ui/kbd";
import { cn } from "@repo/design-system/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
	DoctorsNoteSection,
	type DoctorsNoteSectionConfig,
	type EnhanceOptions,
} from "./DoctorsNoteSection";

// A toggleable section group where user picks which section to show
export interface DoctorsNoteSectionToggle {
	type: "toggle";
	id: string;
	options: Array<{
		id: string;
		label: string;
		section: DoctorsNoteSectionConfig;
	}>;
	defaultOption?: string;
}

// Config item can be a regular section or a toggle group
export type DoctorsNoteConfigItem =
	| DoctorsNoteSectionConfig
	| DoctorsNoteSectionToggle;

// Type guard to check if item is a toggle
function isToggle(
	item: DoctorsNoteConfigItem,
): item is DoctorsNoteSectionToggle {
	return "type" in item && item.type === "toggle";
}

export interface DoctorsNoteEditorConfig {
	title: string;
	description: string;
	icon: LucideIcon;
	sections: DoctorsNoteConfigItem[];
}

export interface EnhanceRequest {
	sectionId: string;
	notes: string;
	context: Record<string, string>;
	/** Callback to stream chunks as they arrive */
	onStream: (chunk: string) => void;
}

interface DoctorsNoteEditorProps {
	config: DoctorsNoteEditorConfig;
	/**
	 * Callback to handle AI enhancement requests with streaming support.
	 * The parent component is responsible for calling the appropriate API endpoint
	 * and calling onStream with each chunk as it arrives.
	 * @param request - Contains sectionId, notes, context, and onStream callback
	 * @returns Promise that resolves when streaming is complete
	 */
	onEnhance: (request: EnhanceRequest) => Promise<void>;
	/**
	 * Optional callback when section values change
	 */
	onValuesChange?: (values: Record<string, string>) => void;
	/**
	 * Optional initial values for sections
	 */
	initialValues?: Record<string, string>;
	/**
	 * Whether the editor is disabled (e.g., during global loading state)
	 */
	disabled?: boolean;
}

// Get all section configs (flattening toggles)
function getAllSectionConfigs(
	items: DoctorsNoteConfigItem[],
): DoctorsNoteSectionConfig[] {
	const sections: DoctorsNoteSectionConfig[] = [];
	for (const item of items) {
		if (isToggle(item)) {
			for (const option of item.options) {
				sections.push(option.section);
			}
		} else {
			sections.push(item);
		}
	}
	return sections;
}

export function DoctorsNoteEditor({
	config,
	onEnhance,
	onValuesChange,
	initialValues = {},
	disabled = false,
}: DoctorsNoteEditorProps) {
	// Get all possible sections for state initialization
	const allSections = getAllSectionConfigs(config.sections);

	// Initialize section values from config
	const [sectionValues, setSectionValues] = useState<Record<string, string>>(
		() => {
			const values: Record<string, string> = {};
			for (const section of allSections) {
				values[section.id] = initialValues[section.id] || "";
			}
			return values;
		},
	);

	// Initialize toggle states
	const [toggleStates, setToggleStates] = useState<Record<string, string>>(
		() => {
			const states: Record<string, string> = {};
			for (const item of config.sections) {
				if (isToggle(item)) {
					states[item.id] = item.defaultOption || item.options[0]?.id || "";
				}
			}
			return states;
		},
	);

	// Handle section value change
	const handleSectionChange = useCallback(
		(sectionId: string, value: string) => {
			setSectionValues((prev) => {
				const next = { ...prev, [sectionId]: value };
				onValuesChange?.(next);
				return next;
			});
		},
		[onValuesChange],
	);

	// Handle toggle change
	const handleToggleChange = useCallback(
		(toggleId: string, optionId: string) => {
			setToggleStates((prev) => ({ ...prev, [toggleId]: optionId }));
		},
		[],
	);

	// Get visible sections (accounting for toggle states)
	const getVisibleSections = useCallback((): DoctorsNoteSectionConfig[] => {
		const visible: DoctorsNoteSectionConfig[] = [];
		for (const item of config.sections) {
			if (isToggle(item)) {
				const selectedOption = toggleStates[item.id];
				const option = item.options.find((o) => o.id === selectedOption);
				if (option) {
					visible.push(option.section);
				}
			} else {
				visible.push(item);
			}
		}
		return visible;
	}, [config.sections, toggleStates]);

	// Create enhance handler for a specific section
	const createEnhanceHandler = useCallback(
		(sectionId: string) => {
			return async (options: EnhanceOptions): Promise<void> => {
				const notes = sectionValues[sectionId];
				const context: Record<string, string> = {};

				// Build context from other visible sections
				const visibleSections = getVisibleSections();
				for (const section of visibleSections) {
					if (section.id !== sectionId && sectionValues[section.id]) {
						context[section.id] = sectionValues[section.id];
					}
				}

				return onEnhance({
					sectionId,
					notes,
					context,
					onStream: options.onStream,
				});
			};
		},
		[sectionValues, getVisibleSections, onEnhance],
	);

	const IconComponent = config.icon;

	return (
		<div className="container mx-auto size-full overflow-y-auto overflow-x-hidden p-4 pb-8">
			<div className="mx-auto max-w-4xl space-y-4">
				{/* Header Section */}
				<div className="flex items-center gap-3">
					<div className="rounded-full bg-solarized-blue/10 p-2">
						<IconComponent className="h-6 w-6 text-solarized-blue" />
					</div>
					<div>
						<h1 className="font-bold text-2xl text-primary">{config.title}</h1>
						<p className="text-muted-foreground text-sm">
							{config.description}
						</p>
					</div>
				</div>

				{/* Privacy Warning - compact */}
				<div className="rounded-lg border border-solarized-red/20 bg-solarized-red/5 px-3 py-2 text-xs">
					<p className="text-solarized-red">
						⚠️ <strong>Datenschutz:</strong> Keine privaten Patientendaten
						eingeben – nur anonymisierte Daten verwenden.
					</p>
				</div>

				{/* Sections */}
				<div className="space-y-4">
					{config.sections.map((item) => {
						if (isToggle(item)) {
							const selectedOption = toggleStates[item.id];
							const option = item.options.find((o) => o.id === selectedOption);

							return (
								<div className="space-y-2" key={item.id}>
									{/* Toggle buttons */}
									<div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
										{item.options.map((opt) => (
											<button
												className={cn(
													"flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-all",
													selectedOption === opt.id
														? "bg-background text-foreground shadow-sm"
														: "text-muted-foreground hover:text-foreground",
												)}
												key={opt.id}
												onClick={() => handleToggleChange(item.id, opt.id)}
												type="button"
											>
												{opt.label}
											</button>
										))}
									</div>

									{/* Selected section */}
									{option && (
										<DoctorsNoteSection
											config={option.section}
											disabled={disabled}
											onChange={(value) =>
												handleSectionChange(option.section.id, value)
											}
											onEnhance={createEnhanceHandler(option.section.id)}
											value={sectionValues[option.section.id] || ""}
										/>
									)}
								</div>
							);
						}

						return (
							<DoctorsNoteSection
								config={item}
								disabled={disabled}
								key={item.id}
								onChange={(value) => handleSectionChange(item.id, value)}
								onEnhance={createEnhanceHandler(item.id)}
								value={sectionValues[item.id] || ""}
							/>
						);
					})}
				</div>

				{/* Footer hint */}
				<div className="flex items-center justify-center gap-4 text-muted-foreground text-xs">
					<div className="flex items-center gap-1.5">
						<Kbd>⌘↵</Kbd>
						<span>zum Verbessern</span>
					</div>
					<span className="text-muted-foreground/50">|</span>
					<span>🔒 Änderungen nur lokal gespeichert</span>
				</div>
			</div>
		</div>
	);
}

// Re-export types for convenience
export type { DoctorsNoteSectionConfig };
