export const ANAMNESE_GUIDELINES = `<instruction_rules>
<template_handling>
- Ersetze alle Platzhalter mit exakten Informationen aus den Inputdaten.
- Befolge Anweisungen in ((...)) strikt und nur an der jeweiligen Stelle.
- Übernimm die Vorlage und Zitate wortwörtlich; Reihenfolge und Abschnitte bleiben erhalten.
</template_handling>

<output_constraints>
- Gib Listen sowie alle Abschnitte klar mit Zeilenabstand aus.
- Jede Listeneintragung steht in einer eigenen Zeile.
- Keine zusätzlichen Kommentare, Einleitungen oder Erklärungen.
</output_constraints>
</instruction_rules>`;
