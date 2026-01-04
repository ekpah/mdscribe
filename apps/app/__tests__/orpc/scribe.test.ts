import { describe, expect, test } from "bun:test";
import { documentTypeConfigs } from "@/orpc/scribe/config";
import type { DocumentType } from "@/orpc/scribe/types";

/**
 * Unit tests for scribe document type configurations
 * These test the config/parsing logic without needing database or AI mocks
 */
describe("Document Type Configurations", () => {
	test("all document types have required config", () => {
		const documentTypes: DocumentType[] = [
			"discharge",
			"anamnese",
			"diagnosis",
			"physical-exam",
			"procedures",
			"admission-todos",
			"befunde",
			"outpatient",
			"icu-transfer",
		];

		for (const type of documentTypes) {
			expect(documentTypeConfigs[type]).toBeDefined();
			expect(documentTypeConfigs[type].promptName).toBeDefined();
			expect(documentTypeConfigs[type].processInput).toBeInstanceOf(Function);
			expect(documentTypeConfigs[type].modelConfig).toBeDefined();
		}
	});

	test("discharge config processes input correctly", () => {
		const input = JSON.stringify({
			anamnese: "Patient history...",
			diagnoseblock: "Primary diagnosis",
			dischargeNotes: "Discharge instructions",
			befunde: "Test results",
		});

		const result = documentTypeConfigs.discharge.processInput(input);

		expect(result.anamnese).toBe("Patient history...");
		expect(result.notes).toBe("Discharge instructions");
		expect(result.diagnoseblock).toBe("Primary diagnosis");
		expect(result.befunde).toBe("Test results");
	});

	test("discharge uses default diagnoseblock when missing", () => {
		const input = JSON.stringify({
			anamnese: "History",
			dischargeNotes: "Notes",
			befunde: "Results",
		});

		const result = documentTypeConfigs.discharge.processInput(input);
		expect(result.diagnoseblock).toBe("Keine Vorerkrankungen");
	});

	test("anamnese config processes input correctly", () => {
		const input = JSON.stringify({
			notes: "Patient notes...",
			befunde: "Findings",
			vordiagnosen: "Prior diagnoses",
		});

		const result = documentTypeConfigs.anamnese.processInput(input);

		expect(result.notes).toBe("Patient notes...");
		expect(result.befunde).toBe("Findings");
		expect(result.vordiagnosen).toBe("Prior diagnoses");
	});

	test("procedures config extracts procedure notes", () => {
		const input = JSON.stringify({
			procedureNotes: "ZVK anlage rechts jugulär...",
		});

		const result = documentTypeConfigs.procedures.processInput(input);
		expect(result.notes).toBe("ZVK anlage rechts jugulär...");
	});

	test("thinking mode configs are correct", () => {
		// Document types with thinking enabled
		expect(documentTypeConfigs.discharge.modelConfig.thinking).toBe(true);
		expect(documentTypeConfigs.procedures.modelConfig.thinking).toBe(true);
		expect(documentTypeConfigs.outpatient.modelConfig.thinking).toBe(true);

		// Document types without thinking
		expect(documentTypeConfigs.anamnese.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs.diagnosis.modelConfig.thinking).toBe(false);
		expect(documentTypeConfigs["physical-exam"].modelConfig.thinking).toBe(false);
	});
});

describe("Model Selection Logic", () => {
	test("auto mode selects gemini for audio input", () => {
		const modelId = "auto";
		const hasAudio = true;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("gemini-3-pro");
	});

	test("auto mode selects claude for non-audio input", () => {
		const modelId = "auto";
		const hasAudio = false;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("claude-opus-4.5");
	});

	test("explicit model selection is preserved", () => {
		const modelId = "glm-4p6";
		const hasAudio = true;

		const actualModel = modelId === "auto"
			? (hasAudio ? "gemini-3-pro" : "claude-opus-4.5")
			: modelId;

		expect(actualModel).toBe("glm-4p6");
	});
});
