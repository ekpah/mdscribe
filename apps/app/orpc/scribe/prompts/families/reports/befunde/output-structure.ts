export const BEFUNDE_OUTPUT_STRUCTURE = `<output_structure>
<befunde>
<format>Abschnittsweise, nach Untersuchungen gegliedert</format>
<entry_structure>
**[Untersuchung, z. B. „Sonographie Abdomen“]** am [Datum]:
[Befundtext in unveränderter Form, geglättet und formal bereinigt]
</entry_structure>
<style>
- Untersuchungstitel fett markieren („**...**“).
- Datum im Format „am TT.MM.JJJJ“ direkt hinter dem Titel.
- Doppelpunkte nach Datumsangabe setzen.
- Befundtext in normaler Schrift, ggf. mit Zeilenumbruch bei längeren Passagen.
- Keine zusätzlichen Überschriften oder Einrückungen.
</style>
</befunde>
</output_structure>`;
