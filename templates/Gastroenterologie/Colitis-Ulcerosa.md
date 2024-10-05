---
inputs: ["Gender", "Name"]
---

Die stationäre Aufnahme von {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} erfolgte bei vorbekannter Colitis Ulcerosa zur geplanten Kontroll-Koloskopie und Optimierung der medikamentösen Therapie.

[#Ergebnis#]

Wir entlassen {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} heute in stabilem Allgemeinzustand in Ihre weitere geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.
