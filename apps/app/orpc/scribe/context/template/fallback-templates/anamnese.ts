const ANAMNESE_FALLBACK_TEMPLATE_CONTENT = `
# Anamnese

{% switch "Geschlecht" %}{% case "Männlich" %}Herr{% /case %}{% case "Weiblich" %}Frau{% /case %}{% /switch %}{% info "Name" /%} stellt sich bei XXX in unserer Notaufnahme vor.

Allergien: Keine bekannt. ((hier Allergien aus Vorbefunden oder was der Patient erwähnt einfügen))

Vormedikation: Keine. ((Hier nur Wirkstoffnamen nennen, außer genaueres ist bekannt. Wenn ganz genaues bekannt ist, dann in einzelnen Zeilen und mit Dosierung aufführen))

Vitalparameter:

Puls 60/min, RR 180/20 mmHg, SpO2 99%, AF 15/min, Blutzucker 120 mg/dl
`;

export const ANAMNESE_FALLBACK_TEMPLATE = {
	content: ANAMNESE_FALLBACK_TEMPLATE_CONTENT,
	examples: [] as string[],
	title: "Standardstruktur Anamnese",
};
