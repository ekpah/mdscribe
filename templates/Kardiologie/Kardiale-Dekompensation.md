---
inputs: ["Gender", "Name"]
---

# Therapie und Verlauf

Die notfallmäßige stationäre Aufnahme von {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} erfolgte bei kardialer Dekompensation.

{% switch "gender" %}
{% case "undefined" %}[#Herr/Frau#]{%/case%}
{% case "male" %}Herr{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} wurde unter dem klinischen Bild einer dekompensierten Herzinsuffizienz mit Belastungsdyspnoe NYHA XX, röntgenologischen Stauungszeichen sowie peripheren Ödemen stationär aufgenommen. Als Dekompensationsgrund werteten wir tachykard übergeleitetes Vorhofflimmern/eine hochgradige Aortenklappenstenose/eine hochgradige Mitralklappeninsuffizienz/eine neu aufgetretene Anämie/unzureichend eingestellten Bluthochdruck/eine progrediente Niereninsuffizienz mit unterdosierter Diuretikatherapie/Medikamentenincompliance.
Echokardiografisch zeigte sich eine erhaltene/eingeschränkte links- und rechtsventrikuläre Funktion sowie eine mittelgradige/hochgradige Stenose/Insuffizienz oder relevantes Vitium/kein relevantes Vitium.
Unter intensivierter/forcierter diuretischer Therapie konnten wir eine Negativbilanzierung und Gewichtsreduktion um XX kg erreichen, damit ging eine deutliche Besserung des klinischen Beschwerdebildes einher.
Zur ätiologischen Abklärung der Herzinsuffizienz erfolgte die invasive Diagnostik. Oder
Bei echokardiografisch nachgewiesenem Vitium erfolgte die Invasivdiagnostik unter präoperativen Gesichtspunkten. Oder
Bei fortgeschrittenem Alter/Multimorbidität/Ablehnung verzichteten wir auf eine vertiefende Diagnostik.
Das Entlassungsgewicht beträgt XXX kg.

Wir bitten um tägliche Gewichtskontrollen, das Einhalten einer Trinkmenge von max. 1,5 Liter pro Tag und bei einer Gewichtszunahme um eine zeitnahe Rücksprache mit dem behandelnden Hausarzt.

Wir bitten im weiteren ambulanten Verlauf um die engmaschige Kontrolle und die strenge Einstellung der kardiovaskulären Risikofaktoren sowie ggf. um die Optimierung der medikamentösen Therapie.

Wir entlassen {% switch "gender" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "male" %}Herrn{%/case%}
{% case "female" %}Frau{%/case%}
{%/switch%}{% info "name" /%} in internistisch stabilem Allgemeinzustand in Ihre geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.



