import type { ReactNode } from "react";

interface BlogPost {
	readonly id: string;
	readonly title: string;
	readonly publishedDate: string;
	readonly description: string;
	readonly content: ReactNode;
}

export const blogPosts: BlogPost[] = [
	{
		content: (
			<div className="space-y-8 text-base leading-8">
				<section className="space-y-4">
					<h2 className="font-semibold text-2xl tracking-tight">Das Problem</h2>
					<p>
						Medizinische Dokumentation ist notwendig, aber sie frisst Zeit. Viele Texte entstehen
						aus wiederkehrenden Mustern: Anamnese, Befund, Diagnose, Verlauf, Procedere. Trotzdem
						müssen sie jedes Mal sauber an den konkreten Fall angepasst werden. Genau an dieser
						Stelle geht im klinischen Alltag viel Aufmerksamkeit verloren.
					</p>
					<p>
						Generische KI-Chatfenster helfen nur begrenzt. Sie kennen die eigenen Formulierungen
						nicht, arbeiten nicht strukturiert mit lokalen Vorlagen und passen selten zu den
						Abläufen einer Praxis oder Klinik. MDScribe ist deshalb nicht als Spielerei gedacht,
						sondern als Arbeitsoberfläche für konkrete Dokumentationsaufgaben.
					</p>
				</section>

				<section className="space-y-4">
					<h2 className="font-semibold text-2xl tracking-tight">Die Idee</h2>
					<p>
						Der Kern ist einfach: medizinische Textbausteine, Vorlagen und KI-gestützte Generierung
						gehören an einen Ort. MDScribe soll wiederverwendbare Struktur bereitstellen, ohne die
						ärztliche Kontrolle aus der Hand zu nehmen. Der generierte Text ist ein Vorschlag, kein
						fertiges Urteil.
					</p>
					<p>
						Das Produkt entsteht aus der Praxis heraus. Es soll dort helfen, wo Dokumentation heute
						unnötig viel Reibung erzeugt: beim Sortieren klinischer Informationen, beim Formulieren
						wiederkehrender Abschnitte und beim Übertragen von Stichpunkten in einen
						nachvollziehbaren medizinischen Text.
					</p>
				</section>

				<section className="space-y-4">
					<h2 className="font-semibold text-2xl tracking-tight">Was MDScribe nicht ist</h2>
					<p>
						MDScribe ersetzt keine ärztliche Entscheidung. Es stellt keine Diagnosen, gibt keine
						Behandlungsanweisungen und ist kein Ersatz für klinisches Denken. Jeder Text muss
						fachlich geprüft, korrigiert und verantwortet werden.
					</p>
					<p>
						Gerade deshalb ist die Oberfläche bewusst auf Bearbeitung, Vorlagen und nachvollziehbare
						Textarbeit ausgelegt. Das Ziel ist nicht maximale Automatisierung um jeden Preis,
						sondern weniger unnötige Schreibarbeit bei erhaltener medizinischer Verantwortung.
					</p>
				</section>

				<section className="space-y-4">
					<h2 className="font-semibold text-2xl tracking-tight">Warum es das gibt</h2>
					<p>
						Weil gute Dokumentation wichtig ist, aber nicht den größten Teil der ärztlichen Energie
						verbrauchen sollte. MDScribe soll helfen, die immer gleichen Textarbeiten schneller und
						konsistenter zu erledigen, damit mehr Zeit für die eigentliche medizinische Arbeit
						bleibt.
					</p>
					<p>
						Der Anfang ist bewusst klein: ein Werkzeug für Textbausteine, Dokumente und KI-gestützte
						Entwürfe. Von dort aus kann MDScribe schrittweise besser werden, wenn klar ist, welche
						Abläufe im klinischen Alltag wirklich zählen.
					</p>
				</section>
			</div>
		),
		description:
			"Warum MDScribe existiert und welches Problem es in der medizinischen Dokumentation lösen soll.",
		id: "1",
		publishedDate: "14. Mai 2026",
		title: "Was ist das hier und warum gibt es MDScribe?",
	},
];

export const getBlogPost = (id: string) => blogPosts.find((post) => post.id === id) ?? null;
