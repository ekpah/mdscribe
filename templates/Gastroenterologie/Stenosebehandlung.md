---
inputs: ["Gender", "Name"]
---

# Diagnosen

Endoskopische Stenosebehandlung bei Stenose [im XXX]

Vordiagnosen:
[Onkologische Diagnose]

# Therapie und Verlauf

Die elektive stationäre Aufnahme von {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} erfolgte zur Stenosebehandlung einer vorbekannten Stenose [des Ösophagus, Kolon etc.].

Nach ausführlicher Aufklärung und Vorbereitung kann die komplikationslose Intervention am Aufnahmetag durchgeführt werden. Der weitere stationäre Verlauf gestaltet sich komplikationslos.

Wir entlassen {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} in stabilem Allgemeinzustand in Ihre geschätzte weitere ambulante haus- und fachärztliche Betreuung.

# Procedere

Leer
