import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

import config from "../tailwind.config";

interface AiTextsAnnouncementTemplateProps {
	readonly actionUrl: string;
	readonly headline?: string;
	readonly buttonText?: string;
	readonly previewText?: string;
	readonly templateButtonText?: string;
	readonly templateUrl?: string;
}

export const AiTextsAnnouncementTemplate = ({
	actionUrl,
	headline = "Neu: Eigene Textbausteine für passgenaue Arztbriefe",
	buttonText = "AI Textbaustein erstellen",
	previewText = "Erstelle zuerst ein Template und mache daraus einen eigenen AI Textbaustein für AIScribe.",
	templateButtonText = "Template erstellen",
	templateUrl = "https://mdscribe.de/templates/create",
}: AiTextsAnnouncementTemplateProps) => {
	const greeting = "Hallo,";

	return (
		<Tailwind config={config}>
			<Html>
				<Head />
				<Preview>{previewText}</Preview>
				<Body className="bg-background font-sans">
					<Container className="mx-auto py-12">
						<Section className="mt-8 rounded-md bg-muted p-px">
							<Section className="rounded-[5px] bg-card p-8">
								<Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">{headline}</Text>

								<Text className="m-0 text-muted-foreground">{greeting}</Text>
								<Text className="text-muted-foreground">
									Heute freuen wir uns, dir eine <strong>neue Funktion</strong> vorstellen zu
									können, um mit MDScribe noch <strong>passgenauere Arztbriefe</strong> schreiben zu
									können. MDScribe funktioniert weiterhin sofort mit einer{" "}
									<strong>Standardvorlage</strong>. Neu ist: Du kannst diese Basis jetzt{" "}
									<strong>deutlich genauer an Deinen klinischen Alltag</strong> anpassen und{" "}
									<strong>eigene Vorlagen</strong> einbinden, um MDScribe genau zu erklären, wie
									deine Briefe aussehen sollen.
								</Text>
								<Text className="text-muted-foreground">
									Statt jedes Mal die gleichen Sachen zu erwähnen oder mühsam etwas umformulieren zu
									müssen, erstellst du so <strong>einmal eine Vorlage</strong> und hast in Zukunft
									immer <strong>passgenaue Arztbriefe oder Befunde</strong>.
								</Text>

								<Section className="mt-6 rounded-md border border-border bg-background p-4">
									<Text className="mt-0 mb-2 font-bold text-foreground text-lg">
										1. Eigenes Template erstellen
									</Text>
									<Text className="text-muted-foreground">
										Lege zuerst ein Template an, das die gewünschte Struktur vorgibt: zum Beispiel
										Überschriften, feste Formulierungen, Auswahlfelder oder Abschnitte für
										Diagnostik, Therapie und Empfehlung. Dieses Template ist die Grundlage, an der
										sich MDScribe später orientiert. Zusätzlich kannst du Beispiele hinzufügen, die
										dir besonders gut gefallen. Der finale Text wird dann ähnlich wie die Beispiele
										klingen und formatiert sein.
									</Text>
									<Button
										className="rounded-md border border-border bg-card px-5 py-3 font-semibold text-foreground text-sm"
										href={templateUrl}
									>
										{templateButtonText}
									</Button>
								</Section>

								<Section className="mt-4 rounded-md border border-border bg-background p-4">
									<Text className="mt-0 mb-2 font-bold text-foreground text-lg">
										2. AI Textbaustein daraus erstellen
									</Text>
									<Text className="text-muted-foreground">
										Öffne danach deine AI-Scribe-Einstellungen, erstelle einen neuen AI
										Textbaustein, wähle das passende Template aus und wähle auch einen Basis-Prompt,
										der zum klinischen Setting passt.
									</Text>
									<Button
										className="rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground text-sm"
										href={actionUrl}
									>
										{buttonText}
									</Button>
								</Section>

								<Section className="mt-6 rounded-md border border-border bg-background p-4">
									<Text className="mt-0 mb-3 font-semibold text-foreground">
										Beispiele aus der Praxis
									</Text>
									<Section className="rounded-sm bg-muted p-3">
										<Text className="m-0 font-semibold text-foreground text-sm">
											Kurzbrief aus der Notaufnahme
										</Text>
										<Text className="mb-0 text-muted-foreground text-xs">
											Für kurze ambulante Entlassungen mit fokussierter Diagnostik, Therapie und
											Empfehlung.
										</Text>
									</Section>
									<Section className="mt-2 rounded-sm bg-muted p-3">
										<Text className="m-0 font-semibold text-foreground text-sm">
											Brief Spezialambulanz
										</Text>
										<Text className="mb-0 text-muted-foreground text-xs">
											Für strukturierte Verlaufsbriefe mit spezieller Fragestellung, Befundbewertung
											und weiterem Vorgehen mit speziellem Fokus
										</Text>
									</Section>
									<Section className="mt-2 rounded-sm bg-muted p-3">
										<Text className="m-0 font-semibold text-foreground text-sm">
											Befund Herzkatheter
										</Text>
										<Text className="mb-0 text-muted-foreground text-xs">
											Für Befunde mit klarer Struktur für Indikation, Befund, Beurteilung und
											konkreter Therapieempfehlung.
										</Text>
									</Section>
								</Section>
								<Hr className="my-4" />
								<Text className="m-0 text-muted-foreground text-sm">
									Viele Grüße,
									<br />
									das MDScribe-Team
								</Text>
							</Section>
						</Section>
					</Container>
				</Body>
			</Html>
		</Tailwind>
	);
};
