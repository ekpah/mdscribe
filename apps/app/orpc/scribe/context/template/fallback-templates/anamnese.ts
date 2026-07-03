const ANAMNESE_FALLBACK_TEMPLATE_CONTENT = `
((Der Patient/die Patientin oder Ansprache mit Name)) stellt sich ((notfallmäßig/in Begleitungs des Rettungsdienstes, Notarztes etc. vor. Dies soll dienen den Vorstellungskontext einordnen zu können.))

Allergien: ((hier Allergien aus Vorbefunden oder was der Patient erwähnt einfügen; wenn gar nichts da steht, dann weglassen ))

Vormedikation: ((Hier nur Wirkstoffnamen nennen, außer genaueres ist bekannt. Wenn ganz genaues bekannt ist, dann in einzelnen Zeilen und mit Dosierung aufführen))

Vitalparameter:

Puls ((Puls))/min, RR ((Blutdruck)) mmHg, SpO2 ((Sättigung))%, AF ((Atemfrequenz))/min, Blutzucker ((Blutzucker)) mg/dl ((alles wo keine Infos vorliegen einfach weglassen. Wenn gar keine Vitalparameter angegeben sind, dann ganz weglassen))

((wenn gar keine Infos zu einem Abschnitt vorliegen, diesen weglassen, keine Platzhalter hier!))
`;

export const ANAMNESE_FALLBACK_TEMPLATE = {
	content: ANAMNESE_FALLBACK_TEMPLATE_CONTENT,
	examples: [] as string[],
	title: "Standardstruktur Anamnese",
};
