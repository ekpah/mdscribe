import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { renderTipTapHTML } from "../editor";
import { validateMarkdocTemplate } from "../parse/validate-markdoc-template";
import { DynamicMarkdocRenderer } from "../react";
import renderMarkdocAsReact from "../render/utils/render-markdoc-as-react";

test("native tables retain merged cells with inline formatting and line breaks", () => {
	const source = `{% table %}
* A
* B
---
* **Assessment**  
  Stable.{% colspan=2 %}
{% /table %}`;
	expect(validateMarkdocTemplate(source)).toEqual([]);
	expect(renderTipTapHTML(source)).toContain(
		'<td colspan="2"><strong>Assessment</strong><br>Stable.</td>',
	);
});

test("template tables carry borders and header styling into rich copies", () => {
	const source = `{% table %}
* A
* B
---
* C
* D
{% /table %}`;
	const html = renderToStaticMarkup(renderMarkdocAsReact(source, { layout: "template" }));
	expect(html).toContain("border-collapse:collapse");
	expect(html).toContain("table-layout:fixed");
	expect(html).toContain("width:100%");
	expect(html).toContain("background-color:#f0f0f0");
	expect(html).toContain("border:1px solid #b8b8b8");
	expect(renderToStaticMarkup(renderMarkdocAsReact(source))).not.toContain("style=");
});

test("conditions and calcs work inside template tables and inside condition cases", () => {
	const source = `{% table %}
* Parameter
* Wert
---
* BMI
* {% calc "bmi" formula="[gewicht] / ([groesse] / 100)^2" round=1 /%} {% condition "bmi" %}{% case lt=18.5 %}Untergewicht{% /case %}{% case default=true %}{% /case %}{% /condition %}
{% /table %}

{% condition "gewicht" %}
{% case gt=100 %}
{% table %}
* Hinweis
---
* Adipositas prüfen
{% /table %}
{% /case %}
{% /condition %}`;
	expect(validateMarkdocTemplate(source)).toEqual([]);
	const render = (variables: Record<string, number>) =>
		renderToStaticMarkup(
			<DynamicMarkdocRenderer layout="template" markdocContent={source} variables={variables} />,
		);
	const empty = render({});
	expect(empty).toContain(">…<");
	expect(empty).not.toContain("Untergewicht");
	expect(empty).not.toContain("Adipositas");
	const filled = render({ gewicht: 110, groesse: 250 });
	expect(filled).toContain(">17.6<");
	expect(filled).toContain("Untergewicht");
	expect(filled).toContain("Adipositas prüfen");
	expect(filled).toContain("border-collapse:collapse");
});
