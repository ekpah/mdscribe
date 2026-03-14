export const ANAMNESE_TEMPLATE_LANGUAGE_RULES = `Regeln zur Template-Sprache:

- Platzhalter stehen in eckigen Klammern: [ ... ]
  Beispiel: [Geburtsdatum], [Diagnose], [Medikation].
  Sie werden direkt durch die passenden medizinischen/administrativen Informationen aus den Inputdaten ersetzt.

- Anweisungen an die KI stehen direkt nach einem Platzhalter bzw. Abschnitt in doppelten runden Klammern: (( ... ))
  Beispiel: [Diagnose]((Fasse die Diagnose in einem Satz präzise zusammen)).
  Diese Anweisungen sind exakt zu befolgen.

- Wörtlicher Text in Anführungszeichen ("...") wird unverändert übernommen.

- Abschnittsüberschriften wie "Anamnese", "Befund", "Plan" bleiben zur Strukturierung bestehen.`;
