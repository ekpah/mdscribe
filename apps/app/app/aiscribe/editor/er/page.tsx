"use client";

import { Heart } from "lucide-react";
import { DoctorsNoteEditor } from '../../_components/DoctorsNoteEditor';
import type { DoctorsNoteEditorConfig } from '../../_components/DoctorsNoteEditor';

// Section configuration for ER documentation
// Each section defines its own endpoint and prompt builder
const ER_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	description:
		"Erstellen und verbessern Sie strukturierte Notfallaufnahme-Dokumentation mit KI-Unterstützung",
	icon: Heart,
	sections: [
		{
			buildPrompt: (notes, context) => ({
				anamnese: context.anamnese || "",
				befunde: context.befunde || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description: "Haupt- und Nebendiagnosen des Patienten",
			documentType: "diagnosis",
			id: "diagnosen",
			label: "Diagnosen",
			placeholder:
				"Diagnosen eingeben (z.B. Verdachtsdiagnosen, Arbeitsdiagnosen)...",
		},
		{
			buildPrompt: (notes, context) => ({
				befunde: context.befunde || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description:
				"Symptome, Beschwerden, Vorgeschichte und relevante Informationen",
			documentType: "anamnese",
			id: "anamnese",
			label: "Anamnese",
			placeholder:
				"Anamnese eingeben (Symptome, Beschwerden, Vorgeschichte)...",
		},
		{
			description:
				"Ergebnisse der körperlichen Untersuchung (Vitalzeichen, Inspektion, Palpation, etc.)",
			id: "koerperlicher_befund",
			label: "Körperlicher Befund",
			placeholder: "Körperlichen Untersuchungsbefund eingeben...",
		},
		{
			buildPrompt: (notes, context) => ({
				anamnese: context.anamnese || "",
				diagnoseblock: context.diagnosen || "",
				notes,
			}),
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde",
			documentType: "befunde",
			id: "befunde",
			label: "Befunde",
			placeholder: "Labor-, Bildgebungs- und weitere Befunde eingeben...",
		},
		// Toggle between Entlassung (Epikrise) and Stationäre Aufnahme (Todos)
		{
			defaultOption: "entlassung",
			id: "disposition",
			options: [
				{
					id: "entlassung",
					label: "Entlassung",
					section: {
						buildPrompt: (notes, context) => ({
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
							notes,
						}),
						description:
							"Zusammenfassung des Aufenthalts, Therapie und Entlassungsempfehlungen",
						documentType: "discharge",
						id: "epikrise",
						label: "Epikrise",
						placeholder:
							"Zusammenfassung und Entlassungsinformationen eingeben...",
					},
				},
				{
					id: "stationaer",
					label: "Stationäre Aufnahme",
					section: {
						buildPrompt: (notes, context) => ({
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
							notes,
						}),
						description:
							"Offene Aufgaben, Anordnungen und To-Dos für die Station",
						documentType: "admission-todos",
						id: "todos",
						label: "Todos",
						placeholder:
							"Aufgaben und nächste Schritte für die stationäre Aufnahme...",
					},
				},
			],
			type: "toggle",
		},
	],
	title: "Notaufnahme Dokumentation",
};

export default function EREditorPage() {
	return <DoctorsNoteEditor config={ER_EDITOR_CONFIG} />;
}
