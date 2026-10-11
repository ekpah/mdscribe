# markdoc-md

**markdoc-md is a templating language for creating reusable templates for quick medical
documentation.** Write the structure, inputs, and rules once, then fill the template with
patient-specific information or let your AI fill it.

## What you'll build

A structured diagnosis block for patients with atrial fibrillation:

> **Atrial fibrillation**
> - **Classification:** Persistent; first diagnosed March 2024
> - **Symptoms:** Modified EHRA IIa
> - **CHA₂DS₂-VA:** 3 points
> - **Anticoagulation:** Apixaban; taken regularly
> - **Treatment strategy:** Rate control

We'll start with placeholders and build up this template step by step, using fictional
patient data to show the result.

## Write templates

### 1. Start with Markdown

Write the diagnosis block as you would any Markdown document. Bold text and lists need no
special syntax beyond Markdown itself. Add placeholders for the parts you want to fill in later.

```markdoc
**Atrial fibrillation**
- **Classification:** [classification]; first diagnosed [month] 20XX
- **Symptoms:** Modified EHRA X
- **CHA₂DS₂-VA:** X points
- **Anticoagulation:** [medication]
- **Treatment strategy:** [strategy]
```

### 2. Replace placeholder text with inputs

An `info` tag inserts a value. The quoted name, such as `"classification"`, names the input
you need to provide. Instead of finding and replacing placeholders, you can fill named fields.

**New: `info` replaces each placeholder with an input.**

```markdoc
**Atrial fibrillation**
- **Classification:** {% info "classification" /%}; first diagnosed {% info "diagnosed" /%}
- **Symptoms:** Modified EHRA {% info "ehra" /%}
- **CHA₂DS₂-VA:** {% info "cha2ds2_va" type="number" unit="points" renderUnit=true /%}
- **Anticoagulation:** {% info "anticoagulation" /%}
- **Treatment strategy:** {% info "strategy" /%}
```

For example, `classification = "Persistent"` and `diagnosed = "March 2024"` reproduce the
first line of the example. You can also provide a type and unit to make fields easier to fill
correctly: the score is a `number`, and `renderUnit=true` adds “points” after its value.

### 3. Select from predefined options

When you don't want to type the full text every time, use `switch` to define options to choose
from. Each `case` contains the text to display for its matching value.

**New: `switch` and `case` replace the treatment-strategy input with two options.**

```markdoc
**Atrial fibrillation**
- **Classification:** {% info "classification" /%}; first diagnosed {% info "diagnosed" /%}
- **Symptoms:** Modified EHRA {% info "ehra" /%}
- **CHA₂DS₂-VA:** {% info "cha2ds2_va" type="number" unit="points" renderUnit=true /%}
- **Anticoagulation:** {% info "anticoagulation" /%}
- **Treatment strategy:** {% switch "strategy" %}{% case "rate" %}Rate control{% /case %}{% case "rhythm" %}Rhythm control{% /case %}{% /switch %}
```
Now `strategy = "rate"` renders “Rate control”, while `"rhythm"` renders “Rhythm control”.
You can use the same pattern for classification or symptom categories.

### 4. Add a checkbox for yes/no information

Some choices only need a yes or no. A switch with `type="checkbox"` lets your application
offer a checkbox—for example, to record whether anticoagulation is taken regularly.

**New: a checkbox switch adds regular intake to the anticoagulation line.**

```markdoc
**Atrial fibrillation**
- **Classification:** {% info "classification" /%}; first diagnosed {% info "diagnosed" /%}
- **Symptoms:** Modified EHRA {% info "ehra" /%}
- **CHA₂DS₂-VA:** {% info "cha2ds2_va" type="number" unit="points" renderUnit=true /%}
- **Anticoagulation:** {% info "anticoagulation" /%}; {% switch "anticoagulation_regular" type="checkbox" %}{% case "true" %}taken regularly{% /case %}{% case "false" %}not taken regularly{% /case %}{% /switch %}
- **Treatment strategy:** {% switch "strategy" %}{% case "rate" %}Rate control{% /case %}{% case "rhythm" %}Rhythm control{% /case %}{% /switch %}
```

Set `anticoagulation_regular` to `true` or `false` to select the wording. Supply the value
explicitly: “unknown” is not the same as “not taken regularly”. `type="boolean"` uses the
same true/false logic. For numeric ranges, use [conditions](docs/reference.md#numeric-conditions)
rather than switches.

### 5. Calculate the full score

You don't need to calculate a clinical score by hand if its inputs are already available.
A `calc` tag does that for you. Its `formula` refers to inputs in square brackets.
Here we declare the inputs inside the tag to give them types and descriptions; only the
final result is displayed. You can also reuse inputs declared elsewhere, and undeclared
formula inputs become number fields automatically.

**New: `calc` replaces the score input with the full CHA₂DS₂-VA calculation.**

```markdoc
**Atrial fibrillation**
- **Classification:** {% info "classification" /%}; first diagnosed {% info "diagnosed" /%}
- **Symptoms:** Modified EHRA {% info "ehra" /%}
- **CHA₂DS₂-VA:**
  {% calc primary="cha2ds2_va" formula="[heart_failure] + [hypertension] + ([age] >= 65) + ([age] >= 75) + [diabetes] + 2 * [stroke_tia_thromboembolism] + [vascular_disease]" unit="points" renderUnit=true %}
  {% info "age" type="number" description="Age in completed years" /%}
  {% switch "heart_failure" type="boolean" /%}
  {% switch "hypertension" type="boolean" /%}
  {% switch "diabetes" type="boolean" /%}
  {% switch "stroke_tia_thromboembolism" type="boolean" /%}
  {% switch "vascular_disease" type="boolean" /%}
  {% /calc %}
- **Anticoagulation:** {% info "anticoagulation" /%}; {% switch "anticoagulation_regular" type="checkbox" %}{% case "true" %}taken regularly{% /case %}{% case "false" %}not taken regularly{% /case %}{% /switch %}
- **Treatment strategy:** {% switch "strategy" %}{% case "rate" %}Rate control{% /case %}{% case "rhythm" %}Rhythm control{% /case %}{% /switch %}
```

The calculation adds the **CHA₂DS₂-VA** components below. Boolean inputs contribute 1 for
`true` and 0 for `false`; a history of stroke, TIA, or arterial thromboembolism counts twice.
The age comparisons contribute 0, 1, or 2 points from a single age input.

| Input | Points |
| --- | --- |
| Chronic heart failure | 1 if present |
| Hypertension | 1 if present |
| Age | 0 under 65; 1 at 65–74; 2 at 75 or older |
| Diabetes mellitus | 1 if present |
| Prior stroke, TIA, or arterial thromboembolism | 2 if present |
| Vascular disease | 1 if present |

**Why no sex category?** This example uses CHA₂DS₂-VA, the score recommended in the
[2024 ESC atrial fibrillation guidelines](https://academic.oup.com/eurheartj/article/45/36/3314/7738779).
Unlike CHA₂DS₂-VASc, it does not include a sex-category point. Its maximum is 8 points.

For our fictional 68-year-old patient with hypertension and diabetes, and all other
components false, the result is 1 + 1 + 1 = **3 points**.

The boolean switches inside `calc` need no cases because they declare inputs rather than
visible text. Supply all components explicitly: unchecked checkboxes count as false, while
missing numeric inputs leave the result as `…`. Leave `cha2ds2_va` out of the supplied values
to use the formula; providing that value overrides the calculation.

### 6. Cite supporting information

Use `cite` to connect text to a source—for example, the MDCalc page explaining the score.
Wrap the score's label in a citation and set `source` to the page URL.

**New: `cite` connects the CHA₂DS₂-VA label to its MDCalc page.**

```markdoc
**Atrial fibrillation**
- **Classification:** {% info "classification" /%}; first diagnosed {% info "diagnosed" /%}
- **Symptoms:** Modified EHRA {% info "ehra" /%}
- **{% cite source="https://www.mdcalc.com/calc/10583/cha2ds2-va-score-atrial-fibrillation-stroke-risk" %}CHA₂DS₂-VA{% /cite %}:**
  {% calc primary="cha2ds2_va" formula="[heart_failure] + [hypertension] + ([age] >= 65) + ([age] >= 75) + [diabetes] + 2 * [stroke_tia_thromboembolism] + [vascular_disease]" unit="points" renderUnit=true %}
  {% info "age" type="number" description="Age in completed years" /%}
  {% switch "heart_failure" type="boolean" /%}
  {% switch "hypertension" type="boolean" /%}
  {% switch "diabetes" type="boolean" /%}
  {% switch "stroke_tia_thromboembolism" type="boolean" /%}
  {% switch "vascular_disease" type="boolean" /%}
  {% /calc %}
- **Anticoagulation:** {% info "anticoagulation" /%}; {% switch "anticoagulation_regular" type="checkbox" %}{% case "true" %}taken regularly{% /case %}{% case "false" %}not taken regularly{% /case %}{% /switch %}
- **Treatment strategy:** {% switch "strategy" %}{% case "rate" %}Rate control{% /case %}{% case "rhythm" %}Rhythm control{% /case %}{% /switch %}
```

You can also cite local standard operating procedures (SOPs), guidelines, or supporting
documents. Your application decides how to open or preview a selected source. See the
[citation reference](docs/reference.md#cite) for file, text, HTTPS, and FHIR sources.

## Developer quick start

Install the package and React for this rendering example:

```sh
npm install markdoc-md react react-dom
```

Import the renderer and pass the complete template from step 6 as a string, along with its values:

```tsx
import { DynamicMarkdocRenderer } from "markdoc-md/react";

const variables = {
  classification: "Persistent",
  diagnosed: "March 2024",
  ehra: "IIa",
  age: 68,
  heart_failure: false,
  hypertension: true,
  diabetes: true,
  stroke_tia_thromboembolism: false,
  vascular_disease: false,
  anticoagulation: "Apixaban",
  anticoagulation_regular: true,
  strategy: "rate",
};

export function DiagnosisBlock({ template }: { template: string }) {
  return <DynamicMarkdocRenderer markdocContent={template} variables={variables} />;
}
```

This renders the diagnosis block with the supplied values and a calculated score of 3 points.
In your application, you can let users enter these values in a form or have an AI agent extract
them from previous documentation. Add `onCitationSelect` to handle source links.

### Discover inputs and validate a template

Use `analyzeMarkdocTemplate` to find the inputs needed for a form. It also returns validation
diagnostics, so you can check the template before saving it.

```ts
import { analyzeMarkdocTemplate } from "markdoc-md";
import type { InputTagType } from "markdoc-md";

const { inputs, diagnostics } = analyzeMarkdocTemplate(template);
const fields: InputTagType[] = inputs;
const blocksSave = diagnostics.some((item) => item.severity === "error");
```

Each `InputTagType` has a `name`, `attributes`, and `children`. For example, the
`classification` field is returned as:

```json
{
  "name": "Info",
  "attributes": {
    "primary": "classification",
    "type": "string",
    "renderUnit": false
  },
  "children": []
}
```

`name` identifies an `Info`, `Switch`, `Case`, or `Calc` input. Switches contain their cases;
calculations contain their component inputs. Numeric conditions contribute individual numeric
fields with branch-visibility metadata. Use `attributes.primary` as the variable name and
`attributes.type` to choose the appropriate input control.

Validation checks template syntax and shared input contracts, not clinical accuracy or
patient-data completeness. Parsing and validation do not require React.

## Reference

- **Language:** [inputs](docs/reference.md#info), [switches and conditions](docs/reference.md#switch-condition-and-case),
  [calculations](docs/reference.md#calc), and [shared variable contracts](docs/reference.md#shared-input-contracts).
- **Structure:** [tables and merged cells](docs/reference.md#tables-and-merged-cells) and
  [collapsible sections](docs/reference.md#details).
- **Sources:** [citations and source formats](docs/reference.md#cite), including FHIR and locator behavior.
- **Developers:** [public entry points](docs/reference.md#public-entry-points),
  [schema extensions](docs/reference.md#extending-the-schema), and
  [rendering, validation, and editor integration](docs/reference.md#rendering-and-validation).
