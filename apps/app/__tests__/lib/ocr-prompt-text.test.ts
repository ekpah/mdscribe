import { expect, test } from "bun:test";

import { formatOcrTextForPrompt } from "@/lib/ocr-prompt-text";

test("OCR tables keep pressure rows, units and empty measurement columns in native Markdoc", () => {
	const source = `# Messung <5 mm
<table><thead><tr><th>Meßdaten</th><th>Ruhe O²</th><th>Volume<br>Challenge</th></tr></thead><tbody>
<tr><td>PAP mmHg</td><td>52 / 26 (36)</td><td></td></tr>
<tr><td>HZV l/min</td><td>4,78</td><td>5.12</td></tr>
<tr><td>PAC</td><td></td><td></td></tr></tbody></table>
Beurteilung: PH`;
	expect(formatOcrTextForPrompt(source)).toBe(`# Messung <5 mm
{% table %}
* Meßdaten
* Ruhe O²
* Volume  
  Challenge
---
* PAP mmHg
* 52 / 26 (36)
* 
---
* HZV l/min
* 4,78
* 5.12
---
* PAC
* 
* 
{% /table %}
Beurteilung: PH`);
});

test("merged header and row cells retain their column associations", () => {
	const source = `<table>
<tr><th rowspan="2">Parameter</th><th colspan="2">Ruhe</th></tr>
<tr><th>vor O²</th><th>mit O²</th></tr>
<tr><td rowspan="2">Sättigung</td><td>91</td><td>97</td></tr>
<tr><td>92</td><td></td></tr></table>`;
	expect(formatOcrTextForPrompt(source)).toBe(`{% table %}
* Parameter{% rowspan=2 %}
* Ruhe{% colspan=2 %}
---
* vor O²
* mit O²
---
* Sättigung{% rowspan=2 %}
* 91
* 97
---
* 92
* 
{% /table %}`);
});

test("plain OCR text is unchanged; table cell entities and literal separators remain text", () => {
	const text = "<NWG\n1 - 2 mg, [x] Ja\n| Feld | Wert |";
	expect(formatOcrTextForPrompt(text)).toBe(text);
	expect(
		formatOcrTextForPrompt("<table><tr><td>A &amp; B | C</td><td>5&nbsp;mg</td></tr></table>"),
	).toBe("{% table %}\n---\n* A &amp; B | C\n* 5 mg\n{% /table %}");
});

test("literal less-than signs survive table parsing without changing surrounding OCR prose", () => {
	const source =
		"<NWG vor der Messung\n<table><tr><td>Troponin</td><td><NWG</td></tr><tr><td>CRP</td><td><5 mg/l</td></tr></table>\n<Nachweisgrenze zwischen den Tabellen\n<table><tr><td>Vergleich</td><td>&lt;NWG</td></tr></table>\n<NWG danach";
	const formatted = formatOcrTextForPrompt(source);
	expect(formatted).toStartWith("<NWG vor der Messung\n{% table %}");
	expect(formatted).toContain("* Troponin\n* &lt;NWG");
	expect(formatted).toContain("* CRP\n* &lt;5 mg/l");
	expect(formatted).toContain("<Nachweisgrenze zwischen den Tabellen\n{% table %}");
	expect(formatted).toContain("* Vergleich\n* &lt;NWG");
	expect(formatted).toEndWith("{% /table %}\n<NWG danach");
	expect(formatOcrTextForPrompt(formatted)).toBe(formatted);
});

test("nested layout tables do not leak closing HTML or join labels with values", () => {
	const text =
		"Befund\n<table><tr><th>Kontext</th><th>Messung</th><th>Wert</th></tr><tr><td><table><tr><td>AF</td><td>15</td></tr><tr><td>Gewicht</td><td>85</td></tr></table></td><td>HF bpm</td><td>83</td></tr><tr><td></td><td>PVR</td><td>468</td></tr></table>\nEnde";
	expect(formatOcrTextForPrompt(text)).toBe(`Befund
{% table %}
* Kontext
* Messung
* Wert
---
* AF 15 Gewicht 85
* HF bpm
* 83
---
* 
* PVR
* 468
{% /table %}
Ende`);
});

test("captions and merged cells survive without expanding source text or evaluating tags", () => {
	const source =
		'<table><caption>Nach Belastung</caption><tr><td colspan="1000">{% info "dosis" /%} [x] A</td></tr></table>';
	const result = formatOcrTextForPrompt(source);
	expect(result).toContain("Nach Belastung\n\n{% table %}\n---");
	expect(result).toContain('&#123;% info "dosis" /%} \\[x\\] A{% colspan=1000 %}');
	expect(result.match(/info/g)).toHaveLength(1);
	expect(result.length).toBeLessThan(200);
	expect(formatOcrTextForPrompt(result)).toBe(result);
});
