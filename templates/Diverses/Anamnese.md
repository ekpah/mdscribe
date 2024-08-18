---
title: Template Library
description: How to use the template library
inputs: ["Gender", "Name"]
---

# Anamnese

Die Vorstellung von {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} erfolgte [elektiv/notfallmäßig] zur [Diagnostik/Intervention], bei bekannter [Vorerkrankung]. {% switch "gender" %}
{% case "undefined" %}Er/Sie{%/case%}
{% case "male" %}Er{%/case%}
{% case "female" %}Sie{%/case%}{%/switch%} beschreibt keine B-Symptomatik (Fieber, Nachtschweiß oder Gewichtsverlust). Infekt oder Schmerzen werden verneint. Es besteht keine Dyspnoe, Stuhlgang und Miktion sind unauffällig. Die Nahrungsaufnahme erfolgt regelrecht und unproblematisch. {% switch "gender" %}
{% case "undefined" %}[#Der Patient/Die Patientin#]{%/case%}
{% case "male" %}Der Patient{%/case%}
{% case "female" %}Die Patientin{%/case%}{%/switch%} wohnhaft in _Wohnung_Eigenheim_, ist mobil und wird von _Partner_Familie_ unterstützt.

Es bestehen keine Allergien. Kein Tabak- oder Alkoholkonsum.
Ein Medikamentenplan wurde vorgelegt.

In der körperlichen Untersuchung präsentiert sich {% switch "gender" %}
{% case "undefined" %}[#Der Patient/Die Patientin#]{%/case%}
{% case "male" %}Der Patient{%/case%}
{% case "female" %}Die Patientin{%/case%}{%/switch%} in gutem Allgemein- und normalgewichtigem Ernährungszustand.
Cor: Herzaktion rhythmisch und normofrequent. Herztöne: rein. Keine Herzgeräusche auskultierbar.
Lunge: vesikuläres Atemgeräusch, keine Rasselgeräusche, kein Giemen oder Brummen.
Abdomen: Abdomen weich, gut eindrückbar, kein Druckschmerz, lebhafte Darmgeräusche über allen vier Quadranten, keine tastbaren Resistenzen.
Leber und Milz nicht vergrößert palpabel. Wirbelsäule und Nierenlager nicht klopfschmerzhaft.
Fußpulse beidseits tastbar. Keine peripheren Ödeme.
Neurologischer Status: grob orientierend unauffällig, kein Hinweis auf ein fokal-neurologisches Defizit.
