---
inputs: ["Gender", "Name"]
---

# Therapie und Verlauf

Die notfallmäßige stationäre Aufnahme von {% switch "Geschlecht" %}
{% case %}[#Herrn/Frau#]{%/case%}
{% case "männlich" %}Herrn{%/case%}
{% case "weiblich" %}Frau{%/case%}
{%/switch%}{% info "Nachnahme" /%} erfolgte bei kardialer Dekompensation.

{% switch "Geschlecht" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "männlich" %}Herrn{%/case%}
{% case "weiblich" %}Frau{%/case%}
{%/switch%}{% info "Nachnahme" /%} wurde unter dem klinischen Bild einer dekompensierten Herzinsuffizienz mit Belastungsdyspnoe NYHA XX, röntgenologischen Stauungszeichen sowie peripheren Ödemen stationär aufgenommen. Als Dekompensationsgrund werteten wir {% switch "Dekompensationsgrund" %}
{% case %}[#Dekompensationsgrund#]{%/case%}
{% case "VHF" %}tachykard übergeleitetes Vorhofflimmern{%/case%}
{% case "hAKS" %}eine hochgradige Aortenklappenstenose{%/case%}
{% case "Mitralklappeninsuffizienz" %}eine hochgradige Aortenklappenstenose{%/case%}
{% case "Anämie" %}eine hochgradige Aortenklappenstenose{%/case%}
{% case "Hypertonie" %}unzureichend eingestellten Bluthochdruck{%/case%}
{% case "CKD" %}eine progrediente Niereninsuffizienz mit unterdosierter Diuretikatherapie{%/case%}
{% case "Incompliance" %}Medikamenten- und Trinkmengenincompliance{%/case%}
{%/switch%}.
Echokardiografisch zeigte sich eine erhaltene/eingeschränkte links- und rechtsventrikuläre Funktion sowie eine mittelgradige/hochgradige Stenose/Insuffizienz oder relevantes Vitium/kein relevantes Vitium.
Unter intensivierter/forcierter diuretischer Therapie konnten wir eine Negativbilanzierung und Gewichtsreduktion um {% info "Gewichtsreduktion" /%} kg erreichen, damit ging eine deutliche Besserung des klinischen Beschwerdebildes einher.
Zur ätiologischen Abklärung der Herzinsuffizienz erfolgte die invasive Diagnostik. Oder
Bei echokardiografisch nachgewiesenem Vitium erfolgte die Invasivdiagnostik unter präoperativen Gesichtspunkten. Oder
Bei fortgeschrittenem Alter/Multimorbidität/Ablehnung verzichteten wir auf eine vertiefende Diagnostik.
Das Entlassungsgewicht beträgt {% info "Entlassgewicht" /%} kg.

Wir bitten um tägliche Gewichtskontrollen, das Einhalten einer Trinkmenge von max. 1,5 Liter pro Tag und bei einer Gewichtszunahme um eine zeitnahe Rücksprache mit dem behandelnden Hausarzt.

Wir bitten im weiteren ambulanten Verlauf um die engmaschige Kontrolle und die strenge Einstellung der kardiovaskulären Risikofaktoren sowie ggf. um die Optimierung der medikamentösen Therapie.

Wir entlassen {% switch "Geschlecht" %}
{% case "undefined" %}[#Herrn/Frau#]{%/case%}
{% case "männlich" %}Herrn{%/case%}
{% case "weiblich" %}Frau{%/case%}
{%/switch%}{% info "Nachnahme" /%} in internistisch stabilem Allgemeinzustand in Ihre geschätzte haus- und fachärztliche Betreuung und stehen bei Rückfragen gerne zur Verfügung.
