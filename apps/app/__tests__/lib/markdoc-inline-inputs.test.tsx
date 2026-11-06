import { describe, expect, test } from "bun:test";

import { DynamicMarkdocRenderer } from "markdoc-md/react";
import { renderToStaticMarkup } from "react-dom/server";

import { inlineInputComponents } from "../../app/_components/markdoc-inline-inputs";

const markdocContent = `{% switch "symptom" %}{% case "none" %}No symptoms{% /case %}{% case "present" %}Symptoms for {% info "days" type="number" /%} days{% /case %}{% /switch %}

{% info "weight" type="number" unit="kg" renderUnit=true /%} / {% info "height" type="number" unit="cm" renderUnit=true /%}: {% calc "bmi" formula="[weight]/([height]/100)^2" round=1 unit="kg/m²" renderUnit=true /%}`;
const variables = { days: 7, height: 181, symptom: "present", weight: 93 };

const render = (editable: boolean) =>
	renderToStaticMarkup(
		<DynamicMarkdocRenderer
			components={inlineInputComponents}
			markdocContent={markdocContent}
			onVariableChange={editable ? () => {} : undefined}
			variables={variables}
		/>,
	);

describe("inline template inputs", () => {
	test("edit raw values in place and keep the selected case with its nested fields", () => {
		const html = render(true);
		expect(html).toContain("Symptoms for");
		expect(html).not.toContain("No symptoms");
		expect(html).toContain('aria-label="days"');
		expect(html).toContain('value="7"');
		// Without the template field state, the result is shown rounded and cannot be overridden.
		expect(html).toContain("28.4 kg/m²");
		expect(html).not.toContain('aria-label="bmi"');
	});

	test("render read-only documents as plain text", () => {
		const html = render(false);
		expect(html).toContain("Symptoms for 7 days");
		expect(html).toContain("93 kg / 181 cm: 28.4 kg/m²");
		expect(html).not.toContain("<input");
		expect(html).not.toContain("<button");
	});
});
