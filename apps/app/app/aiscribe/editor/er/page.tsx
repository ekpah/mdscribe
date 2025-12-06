"use client";

import { Heart } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import {
	DoctorsNoteEditor,
	type DoctorsNoteEditorConfig,
	type EnhanceRequest,
} from "../../_components/DoctorsNoteEditor";

// Section configuration for ER documentation
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
		},
		{
			id: "anamnese",
			label: "Anamnese",
			placeholder:
				"Anamnese eingeben (Symptome, Beschwerden, Vorgeschichte)...",
			description:
				"Symptome, Beschwerden, Vorgeschichte und relevante Informationen",
		},
		{
			id: "koerperlicher_befund",
			label: "Körperlicher Befund",
			placeholder: "Körperlichen Untersuchungsbefund eingeben...",
			description:
				"Ergebnisse der körperlichen Untersuchung (Vitalzeichen, Inspektion, Palpation, etc.)",
		},
		{
			id: "befunde",
			label: "Befunde",
			placeholder: "Labor-, Bildgebungs- und weitere Befunde eingeben...",
			description:
				"Laborwerte, Bildgebung, EKG und weitere diagnostische Befunde",
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
					},
				},
			],
		},
	],
};

// Map section IDs to API endpoints
const SECTION_ENDPOINTS: Record<string, string> = {
	diagnosen: "/api/scribe/diagnosis/stream",
	anamnese: "/api/scribe/anamnese/stream",
	koerperlicher_befund: "/api/scribe/anamnese/stream",
	befunde: "/api/scribe/anamnese/stream",
	epikrise: "/api/scribe/discharge/stream",
	todos: "/api/scribe/anamnese/stream",
};

export default function EREditorPage() {
	// Store abort controllers for each section
	const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

	// Handle AI enhancement for a section with streaming
	const handleEnhance = useCallback(
		async (request: EnhanceRequest): Promise<void> => {
			const { sectionId, notes, context, onStream } = request;

			// Get the appropriate endpoint for this section
			const endpoint = SECTION_ENDPOINTS[sectionId];
			if (!endpoint) {
				throw new Error(
					`Kein API-Endpunkt für Abschnitt "${sectionId}" konfiguriert`,
				);
			}

			// Cancel any existing request for this section
			const existingController = abortControllersRef.current.get(sectionId);
			if (existingController) {
				existingController.abort();
			}

			// Create new abort controller
			const abortController = new AbortController();
			abortControllersRef.current.set(sectionId, abortController);

			try {
				// Build the prompt based on section type
				let prompt: Record<string, string>;

				switch (sectionId) {
					case "diagnosen":
						prompt = {
							notes,
							anamnese: context.anamnese || "",
							befunde: context.befunde || "",
							diagnoseblock: context.diagnosen || "",
						};
						break;
					case "anamnese":
						prompt = {
							notes,
							vordiagnosen: context.diagnosen || "",
							befunde: context.befunde || "",
						};
						break;
					case "koerperlicher_befund":
						prompt = {
							notes,
							vordiagnosen: context.diagnosen || "",
							befunde: context.befunde || "",
						};
						break;
					case "befunde":
						prompt = {
							notes,
							vordiagnosen: context.diagnosen || "",
							anamnese: context.anamnese || "",
						};
						break;
					case "epikrise":
						prompt = {
							dischargeNotes: notes,
							anamnese: context.anamnese || "",
							diagnoseblock: context.diagnosen || "",
							befunde: context.befunde || "",
						};
						break;
					case "todos":
						prompt = {
							notes,
							anamnese: context.anamnese || "",
							vordiagnosen: context.diagnosen || "",
							befunde: context.befunde || "",
						};
						break;
					default:
						prompt = { notes };
				}

				const response = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						prompt: JSON.stringify(prompt),
						model: "auto",
					}),
					signal: abortController.signal,
				});

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(errorText || "Fehler bei der API-Anfrage");
				}

				// Handle streaming response with Vercel AI SDK data stream format
				const reader = response.body?.getReader();
				if (!reader) {
					throw new Error("Keine Antwort vom Server");
				}

				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });

					// Process complete lines in the buffer
					const lines = buffer.split("\n");
					// Keep the last incomplete line in the buffer
					buffer = lines.pop() || "";

					for (const line of lines) {
						const trimmedLine = line.trim();

						// Skip empty lines and [DONE] marker
						if (!trimmedLine || trimmedLine === "data: [DONE]") {
							continue;
						}

						// Parse data lines
						if (trimmedLine.startsWith("data: ")) {
							const jsonStr = trimmedLine.slice(6); // Remove "data: " prefix
							try {
								const data = JSON.parse(jsonStr);

								// Stream text-delta events to the callback
								if (data.type === "text-delta" && data.delta) {
									onStream(data.delta);
								}
							} catch {
								// Ignore JSON parse errors for malformed lines
							}
						}
					}
				}

				// Process any remaining buffer content
				if (buffer.trim()) {
					const trimmedLine = buffer.trim();
					if (
						trimmedLine.startsWith("data: ") &&
						trimmedLine !== "data: [DONE]"
					) {
						const jsonStr = trimmedLine.slice(6);
						try {
							const data = JSON.parse(jsonStr);
							if (data.type === "text-delta" && data.delta) {
								onStream(data.delta);
							}
						} catch {
							// Ignore JSON parse errors
						}
					}
				}

				// Clean up abort controller
				abortControllersRef.current.delete(sectionId);
			} catch (error) {
				// Clean up abort controller
				abortControllersRef.current.delete(sectionId);

				if (error instanceof Error && error.name === "AbortError") {
					throw new Error("Anfrage abgebrochen");
				}

				toast.error(
					error instanceof Error
						? error.message
						: "Fehler beim Verbessern des Textes",
				);
				throw error;
			}
		},
		[],
	);

	return (
		<DoctorsNoteEditor config={ER_EDITOR_CONFIG} onEnhance={handleEnhance} />
	);
}
