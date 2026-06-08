export const SCRIBE_OCR_TO_MARKDOWN_PROMPT = [
	"Du extrahierst den Inhalt eines PDF- oder Bilddokuments per OCR.",
	"Gib ausschließlich Markdown zurück und nutze keine Code-Fences.",
	"Erhalte die Dokumentstruktur mit Überschriften, Listen und Tabellen so gut wie möglich.",
	"Wenn Text unlesbar ist, markiere ihn als [unlesbar] statt Inhalte zu erfinden.",
].join("\n");
