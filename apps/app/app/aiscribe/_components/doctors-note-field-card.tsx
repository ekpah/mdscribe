"use client";

import { getPromptHarnessLabel } from "@/orpc/scribe/prompts";

import { ContextTemplateCard } from "./context-template-card";
import type { DoctorsNoteSectionConfig } from "./doctors-note-section";

interface DoctorsNoteFieldCardProps {
	config: DoctorsNoteSectionConfig;
	className?: string;
}

/**
 * Per-field "Kontext & Vorlage" card rendered beside each editor section.
 *
 * The doctor's note is composed of standardized AIScribe blocks (diagnosis,
 * anamnese, befunde, epikrise, …). Each block maps to a prompt harness and a
 * fallback template; this card surfaces that composition for its field.
 */
export const DoctorsNoteFieldCard = ({
	config,
	className,
}: DoctorsNoteFieldCardProps) => {
	if (!config.documentType) {
		return (
			<ContextTemplateCard
				className={className}
				compact
				emptyLabel="Manuelle Eingabe – keine KI-Generierung."
				title={config.label}
			/>
		);
	}

	return (
		<ContextTemplateCard
			author="MDScribe-Standard"
			className={className}
			compact
			prompt={getPromptHarnessLabel(config.documentType)}
			template={{ title: config.template?.title ?? "Standardstruktur" }}
			title={config.label}
		/>
	);
};
