import { describe, expect, test } from "bun:test";

import { renderTipTapHTML } from "markdoc-md/editor";
import { parseMarkdocToInputs, validateMarkdocTagContracts } from "markdoc-md/parse";
import { DynamicMarkdocRenderer } from "markdoc-md/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { calculateCalcValue, collectFillInputFields } from "@/app/_components/inputs/inputs";

describe("markdoc tags phase 1 regressions", () => {
	test("keeps case scopes separate across switches with same case labels", () => {
		const source = `
{% switch "S1" %}{% case "Ja" %}{% info "I1" /%}{% /case %}{% /switch %}
{% switch "S2" %}{% case "Ja" %}{% info "I2" /%}{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const switchS1 = tags.find((tag) => tag.name === "Switch" && tag.attributes.primary === "S1");
		const switchS2 = tags.find((tag) => tag.name === "Switch" && tag.attributes.primary === "S2");

		expect(switchS1).toBeDefined();
		expect(switchS2).toBeDefined();
		expect(switchS1?.children).toHaveLength(1);
		expect(switchS2?.children).toHaveLength(1);
		expect(switchS1?.children[0]?.children[0]?.attributes.primary).toBe("I1");
		expect(switchS2?.children[0]?.children[0]?.attributes.primary).toBe("I2");
	});

	test("merges repeated switch definitions by primary and retains all cases", () => {
		const source = `
{% switch "Status" %}{% case "A" %}{% info "I1" /%}{% /case %}{% /switch %}
{% switch "Status" %}{% case "B" %}{% info "I2" /%}{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const switches = tags.filter(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Status",
		);
		const [mergedSwitch] = switches;

		expect(switches).toHaveLength(1);
		expect(mergedSwitch?.children.map((child) => child.attributes.primary)).toEqual(["A", "B"]);
	});

	test("preserves boolean switch type when parsing and merging", () => {
		const source = `
	{% switch "Raucher" %}{% case "true" %}Ja{% /case %}{% /switch %}
	{% switch "Raucher" type="boolean" %}{% case "false" %}Nein{% /case %}{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const smokerSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Raucher",
		);

		if (!smokerSwitch || smokerSwitch.name !== "Switch") {
			throw new Error("Expected smoker switch");
		}
		expect(smokerSwitch.attributes.type).toBe("boolean");
		expect(smokerSwitch?.children.map((child) => child.attributes.primary)).toEqual([
			"true",
			"false",
		]);
	});

	test("normalizes legacy switch type=checkbox to type=boolean", () => {
		const source = `
	{% switch "Antikoagulation" type="checkbox" %}{% case "true" %}Ja{% /case %}{% case "false" %}Nein{% /case %}{% /switch %}
	`;

		const tags = parseMarkdocToInputs(source);
		const anticoagulationSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "Antikoagulation",
		);

		if (!anticoagulationSwitch || anticoagulationSwitch.name !== "Switch") {
			throw new Error("Expected anticoagulation switch");
		}

		expect(anticoagulationSwitch.attributes.type).toBe("boolean");
	});

	test("preserves and merges a Switch source attribute", () => {
		const fhirSource = "fhir://Patient.active";
		const source = `
{% switch "Aktiv" type="boolean" %}{% case "true" %}Ja{% /case %}{% /switch %}
{% switch "Aktiv" type="boolean" source=${JSON.stringify(fhirSource)} %}{% case "false" %}Nein{% /case %}{% /switch %}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);
		if (input?.name !== "Switch") {
			throw new Error("Expected switch input");
		}

		expect(diagnostics).toEqual([]);
		expect(input.attributes.source).toBe(fhirSource);
		expect(renderTipTapHTML(source)).toContain(`source="${fhirSource}"`);
	});

	test("normalizes legacy score tags to Calc elements for the rich editor", () => {
		const html = renderTipTapHTML(
			`{% score primary="Risk" formula="[Age]" %}{% info "Age" type="number" /%}{% /score %}`,
		);

		expect(html).toContain("<Calc");
		expect(html).not.toContain("<Score");
	});

	test("keeps formula-only calc tags distinct and collects all variables", () => {
		const source = `
{% calc formula="[A]+[B]" /%}
{% calc formula="[C]+[D]" /%}
`;

		const tags = parseMarkdocToInputs(source);
		const calcTags = tags.filter((tag) => tag.name === "Calc");
		const referencedVariables = calcTags.flatMap((calcTag) =>
			calcTag.children.map((childTag) => childTag.attributes.primary),
		);

		expect(calcTags).toHaveLength(2);
		expect(new Set(referencedVariables)).toEqual(new Set(["A", "B", "C", "D"]));
	});

	test("includes named calculations and their components in autofill metadata", () => {
		const tags = parseMarkdocToInputs(`
{% info "A" type="number" /%}
{% calc primary="Risk" formula="[A]+[B]" unit="Punkte" /%}
`);
		const { fields } = collectFillInputFields(tags);

		expect(fields).toContainEqual({
			calculation: { components: ["A", "B"], formula: "[A]+[B]" },
			description: undefined,
			label: "Risk",
			options: undefined,
			type: "number",
			unit: "Punkte",
		});
		expect(fields.map((field) => field.label)).toEqual(["A", "Risk", "B"]);
	});

	test("keeps explicit checkbox calc components and only synthesizes missing variables", () => {
		const tags = parseMarkdocToInputs(`
{% calc primary="Risk" formula="[Diabetes]+[Alter]" %}
{% switch "Diabetes" type="checkbox" %}
{% case "true" %}Ja{% /case %}
{% case "false" %}Nein{% /case %}
{% /switch %}
{% /calc %}
`);
		const [calc] = tags;

		expect(calc?.name).toBe("Calc");
		if (calc?.name !== "Calc") {
			throw new Error("Expected calc input");
		}
		expect(calc.children.map((child) => [child.name, child.attributes.primary])).toEqual([
			["Switch", "Diabetes"],
			["Info", "Alter"],
		]);
		const { fields } = collectFillInputFields(tags);
		expect(fields.map((field) => [field.label, field.type])).toEqual([
			["Risk", "number"],
			["Diabetes", "boolean"],
			["Alter", "number"],
		]);
	});

	test("does not leak nested case tags into outer switches", () => {
		const source = `
{% switch "outer" %}
{% case "x" %}
{% switch "inner" %}
{% case "y" %}{% info "I1" /%}{% /case %}
{% /switch %}
{% /case %}
{% /switch %}
`;

		const tags = parseMarkdocToInputs(source);
		const outerSwitch = tags.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "outer",
		);
		const outerCase = outerSwitch?.children[0];
		const innerSwitch = outerCase?.children.find(
			(tag) => tag.name === "Switch" && tag.attributes.primary === "inner",
		);

		expect(outerSwitch?.children.map((child) => child.attributes.primary)).toEqual(["x"]);
		expect(innerSwitch).toBeDefined();
		expect(innerSwitch?.children.map((child) => child.attributes.primary)).toEqual(["y"]);
	});

	test("allows compatible repeated info tags and fills optional metadata", () => {
		const source = `
{% info "Gewicht" type="number" /%}
{% info "Gewicht" type="number" unit="kg" description="Körpergewicht" renderUnit=true /%}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);
		if (input?.name !== "Info") {
			throw new Error("Expected info input");
		}

		expect(diagnostics).toEqual([]);
		expect(input?.attributes).toMatchObject({
			description: "Körpergewicht",
			primary: "Gewicht",
			type: "number",
			unit: "kg",
		});
		expect(input?.attributes.renderUnit).toBe(false);
	});

	test("preserves local round settings for info and calc tags", () => {
		const source = `
{% info "Messwert" type="number" round=3 /%}
{% calc "Quotient" formula="[A]/[B]" round=false %}{% info "A" type="number" round=1 /%}{% info "B" type="number" /%}{% /calc %}
`;
		const inputs = parseMarkdocToInputs(source);
		const info = inputs.find((input) => input.name === "Info");
		const calc = inputs.find((input) => input.name === "Calc");
		if (info?.name !== "Info" || calc?.name !== "Calc") {
			throw new Error("Expected info and calc inputs");
		}
		const [component] = calc.children;
		if (component?.name !== "Info") {
			throw new Error("Expected numeric info component");
		}

		expect(info.attributes.round).toBe(3);
		expect(calc.attributes.round).toBe(false);
		expect(component.attributes.round).toBe(1);
		expect(validateMarkdocTagContracts(source)).toEqual([]);

		const html = renderTipTapHTML(source);
		expect(html).toContain('primary="Messwert"');
		expect(html).toContain('round="3"');
		expect(html).toContain('round="false"');
	});

	test("uses calc decimal-place settings in interactive inputs", () => {
		const [fourDecimals, unrounded, defaultRounding] = parseMarkdocToInputs(`
{% calc "FourDecimals" formula="1/3" round=4 /%}
{% calc "Unrounded" formula="1/3" round=false /%}
{% calc "Default" formula="1/3" /%}
		`).filter((input) => input.name === "Calc");

		if (
			fourDecimals?.name !== "Calc" ||
			unrounded?.name !== "Calc" ||
			defaultRounding?.name !== "Calc"
		) {
			throw new Error("Expected calc inputs");
		}

		expect(calculateCalcValue(fourDecimals, {})).toBe(0.3333);
		expect(calculateCalcValue(unrounded, {})).toBe(1 / 3);
		expect(calculateCalcValue(defaultRounding, {})).toBe(0.33);
	});

	test("preserves and merges an Info source attribute", () => {
		const fhirSource =
			"fhir://Observation.where(code.coding.system = 'http://loinc.org' and code.coding.code = '718-7').last().value";
		const source = `
{% info "Hämoglobin" type="number" /%}
{% info "Hämoglobin" type="number" source=${JSON.stringify(fhirSource)} /%}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);
		if (input?.name !== "Info") {
			throw new Error("Expected info input");
		}

		expect(diagnostics).toEqual([]);
		expect(input.attributes.source).toBe(fhirSource);
		expect(renderTipTapHTML(source)).toContain(`source="${fhirSource}"`);
	});

	test("reports conflicting Info sources as a shared-contract error", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% info "Hämoglobin" source="fhir://Observation.first().value" /%}
{% info "Hämoglobin" source="fhir://Observation.last().value" /%}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{
					attribute: "source",
					conflictingValue: "fhir://Observation.last().value",
					firstValue: "fhir://Observation.first().value",
				},
			],
			primary: "Hämoglobin",
			tag: "info",
		});
	});

	test("renders a sourced Info tag from its resolved variable", () => {
		const source = `{% info "fhir-text" source="fhir://Observation.last().note.text" /%}`;
		const html = renderToStaticMarkup(
			createElement(DynamicMarkdocRenderer, {
				markdocContent: source,
				variables: { "fhir-text": "Beliebiger FHIR-Text" },
			}),
		);

		expect(html).toContain("Beliebiger FHIR-Text");
	});

	test("renders boolean source values as text", () => {
		const source = `{% info "active" source="fhir://Patient.active" /%}`;
		const html = renderToStaticMarkup(
			createElement(DynamicMarkdocRenderer, {
				markdocContent: source,
				variables: { active: false },
			}),
		);

		expect(html).toContain("false");
	});

	test("renders an undefined checkbox value as false", () => {
		const source = `
{% switch "Aktiv" type="checkbox" %}
{% case "true" %}Ja{% /case %}
{% case "false" %}Nein{% /case %}
{% /switch %}
`;
		const html = renderToStaticMarkup(
			createElement(DynamicMarkdocRenderer, {
				markdocContent: source,
				variables: {},
			}),
		);

		expect(html).toContain("Nein");
		expect(html).not.toContain("Ja");
	});

	test("normalizes omitted tag types before comparing repeated inputs", () => {
		const compatibleInfo = validateMarkdocTagContracts(`
{% info "Name" /%}
{% info "Name" type="string" /%}
`);
		const conflictingInfo = validateMarkdocTagContracts(`
{% info "Alter" /%}
{% info "Alter" type="number" /%}
`);
		const compatibleSwitch = validateMarkdocTagContracts(`
{% switch "Aktiv" type="checkbox" %}{% case "true" %}Ja{% /case %}{% /switch %}
{% switch "Aktiv" type="boolean" %}{% case "false" %}Nein{% /case %}{% /switch %}
`);

		expect(compatibleInfo).toEqual([]);
		expect(compatibleSwitch).toEqual([]);
		expect(conflictingInfo).toHaveLength(1);
		expect(conflictingInfo[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{
					attribute: "type",
					conflictingValue: "number",
					firstValue: "string",
				},
			],
			primary: "Alter",
			tag: "info",
		});
	});

	test("reports every conflicting info setting with source locations", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% info "Gewicht" type="number" unit="kg" description="Erstes Feld" /%}
{% info "Gewicht" type="date" unit="cm" description="Zweites Feld" /%}
`);

		expect(diagnostics).toHaveLength(1);
		const [diagnostic] = diagnostics;
		expect(diagnostic).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{ attribute: "type", conflictingValue: "date", firstValue: "number" },
				{ attribute: "unit", conflictingValue: "cm", firstValue: "kg" },
				{
					attribute: "description",
					conflictingValue: "Zweites Feld",
					firstValue: "Erstes Feld",
				},
			],
			primary: "Gewicht",
			tag: "info",
		});
		if (diagnostic?.code !== "tag-settings-conflict") {
			throw new Error("Expected settings conflict");
		}
		expect(diagnostic.conflictingLocation?.start.line).toBeDefined();
		expect(diagnostic.conflicts.every((conflict) => conflict.firstLocation)).toBe(true);
	});

	test("rejects input tags of different kinds that share a primary", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% info "Status" /%}
{% switch "Status" %}{% case "A" %}A{% /case %}{% /switch %}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-kind-conflict",
			conflictingTag: "switch",
			firstTag: "info",
			primary: "Status",
		});
	});

	test("allows repeated switches to union cases when their types agree", () => {
		const source = `
{% switch "Status" %}{% case "A" %}A{% /case %}{% /switch %}
{% switch "Status" type="string" %}{% case "B" %}B{% /case %}{% /switch %}
`;

		const diagnostics = validateMarkdocTagContracts(source);
		const [input] = parseMarkdocToInputs(source);

		expect(diagnostics).toEqual([]);
		expect(input?.children.map((child) => child.attributes.primary)).toEqual(["A", "B"]);
	});

	test("reports conflicting switch types", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% switch "Status" type="string" %}{% case "A" %}A{% /case %}{% /switch %}
{% switch "Status" type="boolean" %}{% case "true" %}Ja{% /case %}{% /switch %}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [{ attribute: "type", conflictingValue: "boolean", firstValue: "string" }],
			primary: "Status",
			tag: "switch",
		});
	});

	test("reports conflicting Switch sources", () => {
		const diagnostics = validateMarkdocTagContracts(`
{% switch "Aktiv" source="fhir://Patient.active" %}{% case "true" %}Ja{% /case %}{% /switch %}
{% switch "Aktiv" source="fhir://Patient.deceased" %}{% case "false" %}Nein{% /case %}{% /switch %}
`);

		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [
				{
					attribute: "source",
					conflictingValue: "fhir://Patient.deceased",
					firstValue: "fhir://Patient.active",
				},
			],
			primary: "Aktiv",
			tag: "switch",
		});
	});

	test("keeps calc presentation local and rejects conflicting formulas", () => {
		const compatible = validateMarkdocTagContracts(`
{% calc "BMI" formula="[A]+1" unit="kg" renderUnit=false %}{% info "A" type="number" /%}{% /calc %}
{% calc "BMI" formula="[A]+1" unit="cm" renderUnit=true %}{% info "A" type="number" /%}{% /calc %}
`);
		const conflictingSource = `
{% calc "Total" formula="[A]+1" %}{% info "A" type="number" /%}{% /calc %}
{% calc "Total" formula="[B]+2" %}{% info "B" type="number" /%}{% /calc %}
`;
		const conflicting = validateMarkdocTagContracts(conflictingSource);
		const [calc] = parseMarkdocToInputs(conflictingSource);
		if (calc?.name !== "Calc") {
			throw new Error("Expected calc input");
		}

		expect(compatible).toEqual([]);
		expect(conflicting).toHaveLength(1);
		expect(conflicting[0]).toMatchObject({
			code: "tag-settings-conflict",
			conflicts: [{ attribute: "formula", conflictingValue: "[B]+2", firstValue: "[A]+1" }],
			primary: "Total",
			tag: "calc",
		});
		expect(calc?.attributes.formula).toBe("[A]+1");
		expect(calc?.children.map((child) => child.attributes.primary)).toEqual(["A"]);
	});

	test("keeps unnamed calculations valid and separate when they contain their components", () => {
		const source = `
{% calc formula="[A]+1" %}{% info "A" type="number" /%}{% /calc %}
{% calc formula="[B]+2" %}{% info "B" type="number" /%}{% /calc %}
`;

		expect(validateMarkdocTagContracts(source)).toEqual([]);
		expect(parseMarkdocToInputs(source)).toHaveLength(2);
	});
});
