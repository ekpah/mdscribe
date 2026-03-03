"use client";

import { Stethoscope } from "lucide-react";
import { DoctorsNoteEditor } from '../../_components/DoctorsNoteEditor';
import type { DoctorsNoteEditorConfig } from '../../_components/DoctorsNoteEditor';

// Section configuration for ICU documentation
// Each section defines its own endpoint and prompt builder
// Uses ICU-specific endpoints where available, falls back to ER endpoints
const ICU_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	description:
		"Erstellen und verbessern Sie strukturierte ICU-Dokumentation mit KI-Unterstützung für Entlassungsbriefe",
	icon: Stethoscope,
	sections: [
		{
			buildPrompt: (notes, context) => ({
				anamnese: context.anamnese || "",
				befunde: context.befunde || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description: "Haupt- und Nebendiagnosen sowie relevante Vorerkrankungen",
			documentType: "diagnosis",
			id: "diagnosen",
			label: "Diagnosen",
			placeholder:
				"Diagnosen eingeben (z.B. Hauptdiagnosen, Nebendiagnosen, Vorerkrankungen)...",
		},
		{
			buildPrompt: (notes, context) => ({
				befunde: context.befunde || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description:
				"Anamnese bei ICU-Aufnahme, Aufnahmegrund und relevante Vorgeschichte",
			documentType: "anamnese",
			id: "anamnese",
			label: "Aufnahmeanamnese",
			placeholder:
				"Aufnahmeanamnese eingeben (Aufnahmegrund, Symptome, Vorgeschichte)...",
		},
		{
			description:
				"Körperliche Untersuchung bei ICU-Aufnahme (Vitalzeichen, neurologischer Status, etc.)",
			id: "koerperlicher_befund",
			label: "Körperlicher Befund",
			placeholder: "Körperlichen Untersuchungsbefund bei Aufnahme eingeben...",
		},
		{
			buildPrompt: (notes, context) => ({
				anamnese: context.anamnese || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde sowie Verlauf",
			documentType: "befunde",
			id: "befunde",
			label: "Befunde",
			placeholder:
				"Labor-, Bildgebungs- und weitere Befunde während ICU-Aufenthalt eingeben...",
		},
		// Toggle between Discharge home (Entlassbrief) and Transfer to normal ward (ICU Transfer)
		{
			defaultOption: "verlegung",
			id: "disposition",
			options: [
				{
					id: "entlassung",
					label: "Entlassung nach Hause",
					section: {
						buildPrompt: (notes, context) => ({
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
							notes,
						}),
						description:
							"Zusammenfassung des ICU-Aufenthalts, durchgeführte Therapien und Entlassungsempfehlungen",
						documentType: "discharge",
						id: "entlassungsbrief",
						label: "Entlassungsbrief",
						placeholder:
							"Notizen für Entlassungsbrief eingeben (Therapie, Empfehlungen, Nachsorge)...",
					},
				},
				{
					id: "verlegung",
					label: "Verlegung auf Normalstation",
					section: {
						buildPrompt: (notes, context) => ({
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
							notes,
						}),
						description:
							"Zusammenfassung des ICU-Aufenthalts und Verlegungsinformationen für die Normalstation",
						documentType: "icu-transfer",
						id: "verlegungsbrief",
						label: "Verlegungsbrief",
						placeholder:
							"Notizen für Verlegungsbrief eingeben (Verlegungsgrund, aktueller Zustand, Therapie)...",
					},
				},
			],
			type: "toggle",
		},
	],
	title: "ICU Dokumentation",
};

export default function ICUEditorPage() {
	return <DoctorsNoteEditor config={ICU_EDITOR_CONFIG} />;
}
