import { SnippetsCard } from "../_components/snippets-card";

export default function ProfileTexteditorPage() {
	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h2 className="font-semibold text-solarized-base00 text-2xl">Texteditor</h2>
				<p className="text-sm text-solarized-base01">
					Text-Snippets für schnellen Zugriff beim Schreiben.
				</p>
			</div>
			<SnippetsCard />
		</div>
	);
}
