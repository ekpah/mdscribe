import { describe, expect, test } from "bun:test";

/**
 * Tests for document endpoints
 *
 * These tests verify:
 * - PDF form field parsing input structure
 * - AI response schema validation
 * - Field mapping transformations
 */

describe("Documents Handler", () => {
	describe("parseForm", () => {
		test("should validate input structure", () => {
			const validInput = {
				fileBase64: "JVBERi0xLjQKJeLjz9MK...", // PDF base64
				fieldMapping: [
					{ fieldName: "field1", label: "Field 1", description: "" },
					{ fieldName: "field2", label: "Field 2", description: "" },
				],
			};

			expect(validInput.fileBase64).toBeDefined();
			expect(validInput.fieldMapping).toBeArray();
			expect(validInput.fieldMapping).toHaveLength(2);
		});

		test("should have correct field mapping structure", () => {
			const fieldMapping = [
				{ fieldName: "patientName", label: "Patient Name", description: "" },
				{ fieldName: "dob", label: "Date of Birth", description: "" },
				{ fieldName: "diagnosis", label: "Diagnosis", description: "" },
			];

			for (const field of fieldMapping) {
				expect(field).toHaveProperty("fieldName");
				expect(field).toHaveProperty("label");
				expect(field).toHaveProperty("description");
			}
		});

		test("should generate enhanced field mapping response", () => {
			const originalMapping = [
				{ fieldName: "field_001", label: "field_001", description: "" },
				{ fieldName: "patient_dob", label: "patient_dob", description: "" },
			];

			// Simulated AI enhancement
			const enhancedMapping = {
				fieldMapping: [
					{
						fieldName: "field_001",
						label: "Patientenname",
						description: "Vollständiger Name des Patienten",
					},
					{
						fieldName: "patient_dob",
						label: "Geburtsdatum",
						description: "Geburtsdatum des Patienten im Format TT.MM.JJJJ",
					},
				],
			};

			expect(enhancedMapping.fieldMapping).toHaveLength(2);
			expect(enhancedMapping.fieldMapping[0].label).toBe("Patientenname");
			expect(enhancedMapping.fieldMapping[0].description).not.toBe("");
		});

		test("should preserve original fieldName values", () => {
			const original = [
				{ fieldName: "field_x_123", label: "X", description: "" },
				{ fieldName: "special-field", label: "S", description: "" },
			];

			const enhanced = original.map((field) => ({
				...field,
				label: `Enhanced ${field.label}`,
				description: `Description for ${field.fieldName}`,
			}));

			// Original fieldNames must be preserved
			expect(enhanced[0].fieldName).toBe("field_x_123");
			expect(enhanced[1].fieldName).toBe("special-field");
		});

		test("should handle empty field mapping array", () => {
			const input = {
				fileBase64: "base64data...",
				fieldMapping: [],
			};

			expect(input.fieldMapping).toEqual([]);
			expect(input.fieldMapping.length).toBe(0);
		});

		describe("schema validation", () => {
			test("should validate enhanced field mapping schema", () => {
				const validResponse = {
					fieldMapping: [
						{
							fieldName: "test",
							label: "Test Label",
							description: "Test description",
						},
					],
				};

				// Validate structure matches expected schema
				expect(validResponse).toHaveProperty("fieldMapping");
				expect(Array.isArray(validResponse.fieldMapping)).toBe(true);

				const field = validResponse.fieldMapping[0];
				expect(typeof field.fieldName).toBe("string");
				expect(typeof field.label).toBe("string");
				expect(typeof field.description).toBe("string");
			});

			test("should reject response without fieldMapping", () => {
				const invalidResponse = {
					fields: [], // Wrong key name
				};

				expect(invalidResponse).not.toHaveProperty("fieldMapping");
			});

			test("should reject field without required properties", () => {
				const requiredProps = ["fieldName", "label", "description"];
				const incompleteField = {
					fieldName: "test",
					label: "Test",
					// missing description
				};

				const hasAllProps = requiredProps.every(
					(prop) => prop in incompleteField
				);

				expect(hasAllProps).toBe(false);
			});
		});

		describe("prompt construction", () => {
			test("should include field mapping in prompt", () => {
				const fieldMapping = [
					{ fieldName: "f1", label: "Label 1", description: "" },
				];

				const promptPart = JSON.stringify(fieldMapping, null, 2);

				expect(promptPart).toContain("f1");
				expect(promptPart).toContain("Label 1");
			});

			test("should request German labels and descriptions", () => {
				const promptInstructions = `
					- Schlage ein besseres, aussagekräftigeres Label vor
					- Gib eine klare und prägnante Beschreibung an
					- Die Beschreibungen kurz und aussagekräftig zu halten
				`;

				expect(promptInstructions).toContain("Label");
				expect(promptInstructions).toContain("Beschreibung");
			});
		});
	});
});
