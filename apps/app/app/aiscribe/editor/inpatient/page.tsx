"use client";

import { BedDouble } from "lucide-react";
import {
	DoctorsNoteEditor,
	type DoctorsNoteEditorConfig,
} from "../../_components/DoctorsNoteEditor";

// Section configuration for inpatient (Normalstation) documentation
// Each section defines its own endpoint and prompt builder
const INPATIENT_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	title: "Stationäre Dokumentation",
	description:
		"Erstellen und verbessern Sie strukturierte stationäre Dokumentation mit KI-Unterstützung für Entlassungsbriefe",
	icon: BedDouble,
	sections: [
		{
			id: "diagnosen",
			label: "Diagnosen",
			placeholder:
				"Diagnosen eingeben (z.B. Hauptdiagnosen, Nebendiagnosen, Vorerkrankungen)...",
			description: "Haupt- und Nebendiagnosen sowie relevante Vorerkrankungen",
			apiEndpoint: "/api/scribe/diagnosis/stream",
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
				"Anamnese bei stationärer Aufnahme, Aufnahmegrund und relevante Vorgeschichte",
			apiEndpoint: "/api/scribe/anamnese/stream",
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
				"Körperliche Untersuchung bei Aufnahme (Vitalzeichen, Inspektion, Palpation, etc.)",
		},
		{
			id: "befunde",
			label: "Befunde & Verlauf",
			placeholder:
				"Labor-, Bildgebungs- und weitere Befunde während des Aufenthalts eingeben...",
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde sowie Verlauf",
			apiEndpoint: "/api/scribe/befunde/stream",
			buildPrompt: (notes, context) => ({
				notes,
				vordiagnosen: context.diagnosen || "",
				anamnese: context.anamnese || "",
			}),
		},
		// Toggle between Discharge home (Entlassbrief) and Transfer to ICU/other ward
		{
			type: "toggle",
			id: "disposition",
			defaultOption: "entlassung",
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
							"Zusammenfassung des stationären Aufenthalts, durchgeführte Therapien und Entlassungsempfehlungen",
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
					label: "Verlegung",
					section: {
						id: "verlegungsbrief",
						label: "Verlegungsbrief",
						placeholder:
							"Notizen für Verlegungsbrief eingeben (Verlegungsgrund, aktueller Zustand, offene Punkte)...",
						description:
							"Zusammenfassung des Aufenthalts und Verlegungsinformationen für die weiterbehandelnde Station",
						apiEndpoint: "/api/scribe/discharge/stream",
						buildPrompt: (notes, context) => ({
							dischargeNotes: notes,
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

export default function InpatientEditorPage() {
	return <DoctorsNoteEditor config={INPATIENT_EDITOR_CONFIG} />;
}
