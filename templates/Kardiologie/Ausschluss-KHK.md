---
inputs: ["Gender", "Name"]
---

# Therapie und Verlauf

{%info "gender"%}
{% switch "gender" %}
{% case "undefined" %}[#Herr/Frau#]{%/case%}
{% case "male" %}Herr{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} wurde zur invasiv-kardiologischen Diagnostik, bei Verdacht auf eine koronare Herzkrankheit stationär aufgenommen.

Bei der komplikationslos durchgeführten Koronarangiographie am konnte erfreulicherweise eine KHK ausgeschlossen werden.

Der stationäre Verlauf gestaltete sich komplikationslos, die Leistenpunktionsstelle war reizlos, ein Strömungsgeräusch war nicht auskultierbar.

Wir bitten im weiteren ambulanten Verlauf um engmaschige Kontrolle und strenge Einstellung der kardiovaskulären Risikofaktoren und ggf. Optimierung der medikamentösen Therapie.

Wir entlassen {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%} {% info "name" /%} in gutem Allgemeinzustand in Ihre weitere geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.
