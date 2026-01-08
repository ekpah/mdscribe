"use client";

import { FileCheck } from "lucide-react";
import {
	AiscribeTemplate,
	type AiscribeTemplateConfig,
} from "../_components/AiscribeTemplate";

const DISCHARGE_CONFIG: AiscribeTemplateConfig = {
	// Page identity
	title: "Entlassungsbrief",
	description:
		"Erstellen Sie professionelle Entlassungsbriefe für Ihre Patienten",
	icon: FileCheck,

	// Document type for oRPC
	documentType: "discharge",

	// Tab configuration
	inputTabTitle: "Entlassungsnotizen",
	outputTabTitle: "Entlassungsbrief",

	// Form configuration
	inputFieldName: "dischargeNotes",
	inputPlaceholder: "Geben Sie hier Ihre Entlassungsnotizen ein...",
	inputDescription:
		"Dokumentieren Sie den Krankheitsverlauf, die Behandlung und Empfehlungen für die Weiterbehandlung. Fügen Sie hier auch den aktuellen Stand des Entlassungsbriefes ein.",

	// Additional input fields
	additionalInputs: [
		{
			name: "diagnoseblock",
			label: "Diagnoseblock",
			placeholder: "Diagnoseblock eingeben...",
			required: false,
			type: "textarea",
			description:
				"Diagnoseblock des aktuellen Arztbriefes inkl. aktueller Diagnose und Vorerkrankungen (chronische Erkrankungen, Z.n. Operationen etc.)",
		},
		{
			name: "anamnese",
			label: "Aufnahmeanamnese",
			placeholder: "Initiale Anamnese bei Aufnahme eingeben...",
			required: false,
			type: "textarea",
			description:
				"Anamnese bei Aufnahme inkl. Aufnahmegrund und initiale Verdachtsdiagnose",
		},
		{
			name: "befunde",
			label: "Befunde",
			placeholder: "Befunde aus dem stationären Aufenthalt eingeben...",
			required: false,
			type: "textarea",
			description:
				"Chronologische Auflistung aller Untersuchungen, Konsile und wichtigen Einträge während des Aufenthalts",
		},
	],

	// Button text
	generateButtonText: "Entlassungsbrief generieren",
	regenerateButtonText: "Neu generieren",

	// Empty state messages
	emptyStateTitle: "Noch kein Entlassungsbrief vorhanden",
	emptyStateDescription:
		"Bitte geben Sie zuerst Entlassungsnotizen ein und generieren Sie einen Entlassungsbrief.",
};

export default function DischargeAIGenerator() {
	return <AiscribeTemplate config={DISCHARGE_CONFIG} />;
}
