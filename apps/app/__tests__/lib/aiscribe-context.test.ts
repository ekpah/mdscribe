import { describe, expect, test } from "bun:test";
import { createAiscribeContext } from "@/lib/aiscribe-context";

describe("createAiscribeContext", () => {
	test("formats all sections and builds prompt", () => {
		const result = createAiscribeContext({
			context: {
				Patient: "Max Muster",
				Alter: 54,
				Allergien: "",
			},
			practitionerInfo: [
				{ label: "Name", value: "Dr. Jane Doe" },
				{ label: "Fachgebiet", value: "Kardiologie" },
			],
			organizationInfo: {
				Institution: "Klinikum Nord",
				Kontakt: ["030-123", "030-456"],
				Standards: undefined,
			},
		});

		expect(result.context).toBe("Patient: Max Muster\nAlter: 54");
		expect(result.practitionerInfo).toBe(
			"Name: Dr. Jane Doe\nFachgebiet: Kardiologie",
		);
		expect(result.organizationInfo).toBe(
			"Institution: Klinikum Nord\nKontakt: 030-123, 030-456",
		);
		expect(result.sections).toHaveLength(3);
		expect(result.prompt).toContain("<aiscribe_context>");
		expect(result.prompt).toContain("<context>");
		expect(result.prompt).toContain("<practitioner_info>");
		expect(result.prompt).toContain("<organization_info>");
	});

	test("omits empty sections from prompt", () => {
		const result = createAiscribeContext({
			context: "  Patient anonym  ",
			practitionerInfo: { Name: " " },
		});

		expect(result.sections).toHaveLength(1);
		expect(result.prompt).toContain("<context>");
		expect(result.prompt).not.toContain("practitioner_info");
		expect(result.organizationInfo).toBe("");
	});
});
