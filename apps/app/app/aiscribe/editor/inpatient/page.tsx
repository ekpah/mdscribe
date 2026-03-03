"use client";

import { BedDouble } from "lucide-react";
import { DoctorsNoteEditor } from '../../_components/DoctorsNoteEditor';
import type { DoctorsNoteEditorConfig } from '../../_components/DoctorsNoteEditor';

// Section configuration for inpatient (Normalstation) documentation
// Each section defines its own endpoint and prompt builder
const INPATIENT_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	description:
		"Erstellen und verbessern Sie strukturierte stationäre Dokumentation mit KI-Unterstützung für Entlassungsbriefe",
	icon: BedDouble,
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
				"Anamnese bei stationärer Aufnahme, Aufnahmegrund und relevante Vorgeschichte",
			documentType: "anamnese",
			id: "anamnese",
			label: "Aufnahmeanamnese",
			placeholder:
				"Aufnahmeanamnese eingeben (Aufnahmegrund, Symptome, Vorgeschichte)...",
		},
		{
			description:
				"Körperliche Untersuchung bei Aufnahme (Vitalzeichen, Inspektion, Palpation, etc.)",
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
			label: "Befunde & Verlauf",
			placeholder:
				"Labor-, Bildgebungs- und weitere Befunde während des Aufenthalts eingeben...",
		},
		// Toggle between Discharge home (Entlassbrief) and Transfer to ICU/other ward
		{
			defaultOption: "entlassung",
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
							"Zusammenfassung des stationären Aufenthalts, durchgeführte Therapien und Entlassungsempfehlungen",
						documentType: "discharge",
						id: "entlassungsbrief",
						label: "Entlassungsbrief",
						placeholder:
							"Notizen für Entlassungsbrief eingeben (Therapie, Empfehlungen, Nachsorge)...",
					},
				},
				{
					id: "verlegung",
					label: "Verlegung",
					section: {
						buildPrompt: (notes, context) => ({
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
							notes,
						}),
						description:
							"Zusammenfassung des Aufenthalts und Verlegungsinformationen für die weiterbehandelnde Station",
						documentType: "discharge",
						id: "verlegungsbrief",
						label: "Verlegungsbrief",
						placeholder:
							"Notizen für Verlegungsbrief eingeben (Verlegungsgrund, aktueller Zustand, offene Punkte)...",
					},
				},
			],
			type: "toggle",
		},
	],
	title: "Stationäre Dokumentation",
};

export default function InpatientEditorPage() {
	return <DoctorsNoteEditor config={INPATIENT_EDITOR_CONFIG} />;
}
