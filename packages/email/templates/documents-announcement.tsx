import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Row,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";

import config from "../tailwind.config";

interface DocumentsAnnouncementTemplateProps {
	readonly userName?: string | undefined;
	readonly actionUrl: string;
	readonly headline?: string;
	readonly buttonText?: string;
	readonly previewText?: string;
}

export const DocumentsAnnouncementTemplate = ({
	userName,
	actionUrl,
	headline = "Neu in Entwicklung: Rehaanträge schneller vorbereiten",
	buttonText = "Dokumente testen",
	previewText = "Rehaanträge, Befundberichte und andere PDF-Dokumente per Diktat und KI vorbereiten.",
}: DocumentsAnnouncementTemplateProps) => {
	const greeting = userName ? `Hallo ${userName},` : "Hallo,";

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
								<Section className="mb-6 rounded-md bg-background p-4">
									<Row>
										<Column className="w-[56%] pr-3 align-top">
											<Section className="rounded-md border border-border bg-card p-4">
												<Text className="m-0 font-semibold text-foreground text-sm">
													DRV Rehaantrag
												</Text>
												<Text className="m-0 text-muted-foreground text-xs">
													G0100 / G0110 + Befundbericht
												</Text>
												<Section className="mt-4 h-3 rounded-sm bg-muted" />
												<Section className="mt-2 h-3 w-[76%] rounded-sm bg-muted" />
												<Section className="mt-5 rounded-sm border border-border p-2">
													<Text className="m-0 text-muted-foreground text-xs">Reha-Indikation</Text>
													<Section className="mt-1 h-2 rounded-sm bg-primary" />
												</Section>
												<Section className="mt-2 rounded-sm border border-border p-2">
													<Text className="m-0 text-muted-foreground text-xs">
														Funktionsbeeinträchtigung
													</Text>
													<Section className="mt-1 h-2 rounded-sm bg-primary" />
												</Section>
												<Section className="mt-2 rounded-sm border border-border p-2">
													<Text className="m-0 text-muted-foreground text-xs">Therapieziel</Text>
													<Section className="mt-1 h-2 w-[72%] rounded-sm bg-primary" />
												</Section>
											</Section>
										</Column>
										<Column className="w-[44%] pl-3 align-top">
											<Section className="rounded-md bg-muted p-3 text-center">
												<Text className="m-0 text-3xl text-foreground">🎙️</Text>
												<Text className="m-0 font-semibold text-foreground text-sm">Diktat</Text>
												<Text className="mb-3 text-muted-foreground text-xs">
													"Patientin mit chronischen Rückenschmerzen..."
												</Text>
												<Text className="m-0 text-2xl text-foreground">↓</Text>
												<Text className="m-0 font-semibold text-foreground text-sm">
													KI-Struktur
												</Text>
												<Text className="mb-0 text-muted-foreground text-xs">
													Angaben werden passenden Formularfeldern zugeordnet.
												</Text>
											</Section>
										</Column>
									</Row>
								</Section>
								<Text className="m-0 text-muted-foreground">{greeting}</Text>
								<Text className="text-muted-foreground">
									wir arbeiten gerade an einem neuen Dokumente-Bereich in MDScribe. Ein typischer
									Anwendungsfall: Rehaanträge für die Deutsche Rentenversicherung vorbereiten,
									inklusive Anlage und ärztlichem Befundbericht.
								</Text>
								<Text className="text-muted-foreground">
									Statt Angaben aus Gespräch, Anamnese und Befund manuell in PDF-Felder zu
									übertragen, sollst Du relevante Informationen diktieren oder einfügen können.
									MDScribe strukturiert daraus einen Vorschlag für Formularfelder, Begründung und
									Befundbericht.
								</Text>
								<Text className="font-bold text-lg text-muted-foreground">
									Warum gerade Rehaanträge?
								</Text>
								<Section>
									<Row>
										<Column className="w-[33%] pr-2 align-top">
											<Section className="rounded-md bg-muted p-3">
												<Text className="m-0 font-semibold text-foreground text-sm">Häufig</Text>
												<Text className="mb-0 text-muted-foreground text-xs">
													Medizinische Reha ist ein wiederkehrender Fall im Praxisalltag.
												</Text>
											</Section>
										</Column>
										<Column className="w-[33%] px-1 align-top">
											<Section className="rounded-md bg-muted p-3">
												<Text className="m-0 font-semibold text-foreground text-sm">
													Strukturiert
												</Text>
												<Text className="mb-0 text-muted-foreground text-xs">
													Antrag, Anlage und Befundbericht folgen klaren Formularlogiken.
												</Text>
											</Section>
										</Column>
										<Column className="w-[33%] pl-2 align-top">
											<Section className="rounded-md bg-muted p-3">
												<Text className="m-0 font-semibold text-foreground text-sm">
													Diktierbar
												</Text>
												<Text className="mb-0 text-muted-foreground text-xs">
													Indikation, Verlauf und Ziele lassen sich natürlich ärztlich formulieren.
												</Text>
											</Section>
										</Column>
									</Row>
								</Section>
								<Text className="text-muted-foreground">
									Die Funktion befindet sich noch in Entwicklung. Du kannst den neuen Bereich aber
									bereits öffnen und uns früh Feedback geben, welche Reha- und Formularprozesse in
									Deinem Alltag am meisten Zeit kosten.
								</Text>
								<Hr className="my-4" />
								<Button
									className="rounded-md bg-primary px-6 py-3 font-semibold text-lg text-primary-foreground"
									href={actionUrl}
								>
									{buttonText}
								</Button>
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
