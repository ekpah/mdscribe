"use client";

import { Heart } from "lucide-react";
import { DoctorsNoteEditor } from '@/app/aiscribe/_components/doctors-note-editor';
import type { DoctorsNoteEditorConfig } from '@/app/aiscribe/_components/doctors-note-editor';

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
		{
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
			placeholder: "Zusammenfassung und Entlassungsinformationen eingeben...",
		},
	],
	title: "Notaufnahme Dokumentation",
};

export default function EREditorPage() {
	return <DoctorsNoteEditor config={ER_EDITOR_CONFIG} />;
}
