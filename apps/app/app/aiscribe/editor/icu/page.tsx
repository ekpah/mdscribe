"use client";

import { Stethoscope } from "lucide-react";
import {
	DoctorsNoteEditor,
	type DoctorsNoteEditorConfig,
} from "../../_components/DoctorsNoteEditor";

// Section configuration for ICU documentation
// Each section defines its own endpoint and prompt builder
// Uses ICU-specific endpoints where available, falls back to ER endpoints
const ICU_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	title: "ICU Dokumentation",
	description:
		"Erstellen und verbessern Sie strukturierte ICU-Dokumentation mit KI-Unterstützung für Entlassungsbriefe",
	icon: Stethoscope,
	sections: [
		{
			id: "diagnosen",
			label: "Diagnosen",
			placeholder:
				"Diagnosen eingeben (z.B. Hauptdiagnosen, Nebendiagnosen, Vorerkrankungen)...",
			description: "Haupt- und Nebendiagnosen sowie relevante Vorerkrankungen",
			apiEndpoint: "/api/scribe/diagnosis/stream", // Use ER endpoint as fallback
			buildPrompt: (notes, context) => ({
				notes,
				anamnese: context.anamnese || "",
				befunde: context.befunde || "",
				diagnoseblock: context.diagnosen || "",
			}),
		},
		{
			id: "anamnese",
			label: "Aufnahmeanamnese",
			placeholder:
				"Aufnahmeanamnese eingeben (Aufnahmegrund, Symptome, Vorgeschichte)...",
			description:
				"Anamnese bei ICU-Aufnahme, Aufnahmegrund und relevante Vorgeschichte",
			apiEndpoint: "/api/scribe/anamnese/stream", // Use ER endpoint as fallback
			buildPrompt: (notes, context) => ({
				notes,
				vordiagnosen: context.diagnosen || "",
				befunde: context.befunde || "",
			}),
		},
		{
			id: "koerperlicher_befund",
			label: "Körperlicher Befund",
			placeholder: "Körperlichen Untersuchungsbefund bei Aufnahme eingeben...",
			description:
				"Körperliche Untersuchung bei ICU-Aufnahme (Vitalzeichen, neurologischer Status, etc.)",
		},
		{
			id: "befunde",
			label: "Befunde",
			placeholder:
				"Labor-, Bildgebungs- und weitere Befunde während ICU-Aufenthalt eingeben...",
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde sowie Verlauf",
			apiEndpoint: "/api/scribe/befunde/stream", // Use ER endpoint as fallback
			buildPrompt: (notes, context) => ({
				notes,
				vordiagnosen: context.diagnosen || "",
				anamnese: context.anamnese || "",
			}),
		},
		// Toggle between Discharge home (Entlassbrief) and Transfer to normal ward (ICU Transfer)
		{
			type: "toggle",
			id: "disposition",
			defaultOption: "verlegung",
			options: [
				{
					id: "entlassung",
					label: "Entlassung nach Hause",
					section: {
						id: "entlassungsbrief",
						label: "Entlassungsbrief",
						placeholder:
							"Notizen für Entlassungsbrief eingeben (Therapie, Empfehlungen, Nachsorge)...",
						description:
							"Zusammenfassung des ICU-Aufenthalts, durchgeführte Therapien und Entlassungsempfehlungen",
						apiEndpoint: "/api/scribe/discharge/stream",
						buildPrompt: (notes, context) => ({
							dischargeNotes: notes,
							anamnese: context.anamnese || "",
							diagnoseblock: context.diagnosen || "",
							befunde: context.befunde || "",
						}),
					},
				},
				{
					id: "verlegung",
					label: "Verlegung auf Normalstation",
					section: {
						id: "verlegungsbrief",
						label: "Verlegungsbrief",
						placeholder:
							"Notizen für Verlegungsbrief eingeben (Verlegungsgrund, aktueller Zustand, Therapie)...",
						description:
							"Zusammenfassung des ICU-Aufenthalts und Verlegungsinformationen für die Normalstation",
						apiEndpoint: "/api/scribe/icu/transfer/stream",
						buildPrompt: (notes, context) => ({
							notes,
							anamnese: context.anamnese || "",
							diagnoseblock: context.diagnosen || "",
							befunde: context.befunde || "",
						}),
					},
				},
			],
		},
	],
};

export default function ICUEditorPage() {
	return <DoctorsNoteEditor config={ICU_EDITOR_CONFIG} />;
}
