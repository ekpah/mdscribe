import { describe, expect, test } from "bun:test";

import { validateMarkdocTemplate } from "markdoc-md/parse";

import { formatMarkdocTagDiagnostic } from "@/lib/user-messages";

const messages = (template: string) =>
	validateMarkdocTemplate(template).map((diagnostic) => formatMarkdocTagDiagnostic(diagnostic));

describe("template diagnostic messages", () => {
	test("Markdoc schema errors are shown in German with their names", () => {
		expect(messages(`{% calc formula="1" /%}`)).toContain("Pflichtattribut „primary“ fehlt.");
		expect(messages(`{% info "a" foo="b" /%}`)).toContain("Unbekanntes Attribut „foo“.");
		expect(
			messages(`{% switch "s" type="number" %}{% case "a" %}A{% /case %}{% /switch %}`),
		).toContain("Attribut „type“ hat einen ungültigen Wert (erlaubt: string, boolean, checkbox).");
		expect(messages(`{% info "a" description=5 /%}`)).toContain(
			"Attribut „description“ hat den falschen Typ (erwartet: Text).",
		);
		expect(messages(`{% details %}\nBody`)).toContain("Tag „details“ wird nicht geschlossen.");
		expect(messages(`{% unknown /%}`)).toContain("Unbekannter Tag „unknown“.");
		expect(messages(`{% calc "c" formula="1" round=1.5 /%}`)).toContain(
			"„round“ muss false oder eine ganze Zahl von 0 bis 100 sein.",
		);
	});

	test("a text field used in a formula asks for a number type", () => {
		expect(
			messages(`Gewicht: {% info "Gewicht" /%} kg {% calc "Haelfte" formula="[Gewicht] / 2" /%}`),
		).toEqual([
			'„Gewicht“ wird in der Formel von Calc „Haelfte“ verwendet, ist aber ein Textfeld – bitte type="number" ergänzen.',
		]);
		expect(
			messages(`{% info "Gewicht" type="number" /%} {% calc "Haelfte" formula="[Gewicht] / 2" /%}`),
		).toEqual([]);
	});

	test("no template diagnostic falls back to an English message", () => {
		for (const template of [
			`{% calc formula="(" /%}`,
			`{% cite source="nope" %}x{% /cite %}`,
			`{% condition "x" %}{% case gt=2 lt=1 %}x{% /case %}{% /condition %}`,
		]) {
			for (const message of messages(template)) {
				expect(message).not.toMatch(/\b(Attribute|Missing|Invalid|Undefined|must)\b/u);
			}
		}
	});
});
