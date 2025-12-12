"use client";

import { Heart } from "lucide-react";
import {
	DoctorsNoteEditor,
	type DoctorsNoteEditorConfig,
} from "../../_components/DoctorsNoteEditor";

// Section configuration for ER documentation
// Each section defines its own endpoint and prompt builder
const ER_EDITOR_CONFIG: DoctorsNoteEditorConfig = {
	title: "Notaufnahme Dokumentation",
	description:
		"Erstellen und verbessern Sie strukturierte Notfallaufnahme-Dokumentation mit KI-Unterstützung",
	icon: Heart,
	sections: [
		{
			id: "diagnosen",
			label: "Diagnosen",
			placeholder:
				"Diagnosen eingeben (z.B. Verdachtsdiagnosen, Arbeitsdiagnosen)...",
			description: "Haupt- und Nebendiagnosen des Patienten",
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
			label: "Anamnese",
			placeholder:
				"Anamnese eingeben (Symptome, Beschwerden, Vorgeschichte)...",
			description:
				"Symptome, Beschwerden, Vorgeschichte und relevante Informationen",
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
			placeholder: "Körperlichen Untersuchungsbefund eingeben...",
			description:
				"Ergebnisse der körperlichen Untersuchung (Vitalzeichen, Inspektion, Palpation, etc.)",
			apiEndpoint: "/api/scribe/anamnese/stream",
			buildPrompt: (notes, context) => ({
				notes,
				vordiagnosen: context.diagnosen || "",
				befunde: context.befunde || "",
			}),
		},
		{
			id: "befunde",
			label: "Befunde",
			placeholder: "Labor-, Bildgebungs- und weitere Befunde eingeben...",
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde",
			apiEndpoint: "/api/scribe/anamnese/stream",
			buildPrompt: (notes, context) => ({
				notes,
				vordiagnosen: context.diagnosen || "",
				anamnese: context.anamnese || "",
			}),
		},
		// Toggle between Entlassung (Epikrise) and Stationäre Aufnahme (Todos)
		{
			type: "toggle",
			id: "disposition",
			defaultOption: "entlassung",
			options: [
				{
					id: "entlassung",
					label: "Entlassung",
					section: {
						id: "epikrise",
						label: "Epikrise",
						placeholder:
							"Zusammenfassung und Entlassungsinformationen eingeben...",
						description:
							"Zusammenfassung des Aufenthalts, Therapie und Entlassungsempfehlungen",
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
					id: "stationaer",
					label: "Stationäre Aufnahme",
					section: {
						id: "todos",
						label: "Todos",
						placeholder:
							"Aufgaben und nächste Schritte für die stationäre Aufnahme...",
						description:
							"Offene Aufgaben, Anordnungen und To-Dos für die Station",
						apiEndpoint: "/api/scribe/anamnese/stream",
						buildPrompt: (notes, context) => ({
							notes,
							anamnese: context.anamnese || "",
							vordiagnosen: context.diagnosen || "",
							befunde: context.befunde || "",
						}),
					},
				},
			],
		},
	],
};

export default function EREditorPage() {
	return <DoctorsNoteEditor config={ER_EDITOR_CONFIG} />;
}
