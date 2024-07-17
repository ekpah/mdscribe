---
inputs: ["Gender", "Name"]
---

# Diagnosen

Polypektomie von [einem, zwei] Polypen im [wo der Polyp ist]

- Histologie folgt

# Therapie und Verlauf

Die stationäre Aufnahme von {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} erfolgte geplant zur Polypektomie.

Nach ausführlicher Aufklärung und Vorbereitung kann die geplante Endoskopie am Folgetag erfolgreich und komplikationslos durchgeführt werden. In der anschließenden stationären Nachbeobachtung zeigen sich keine Komplikationen und insbesondere keine akuten Zeichen einer Perforation oder Nachblutung.

Die histologische Aufarbeitung steht zum Entlasszeitpunkt noch aus und wird von uns nachberichtet werden.

Wir entlassen {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} heute in stabilem Allgemeinzustand in Ihre weitere geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.

# Procedere

- Nächste Vorsorgekoloskopie in [1, 5, 10] Jahren empfohlen
