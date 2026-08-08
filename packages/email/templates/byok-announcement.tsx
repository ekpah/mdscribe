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

interface ByokAnnouncementTemplateProps {
	readonly actionUrl: string;
	readonly buttonText?: string;
	readonly previewText?: string;
}

export const ByokAnnouncementTemplate = ({
	actionUrl,
	buttonText = "Eigenen API-Schlüssel hinterlegen",
	previewText = "Neu: Eigene API-Schlüssel für freigeschaltete KI-Verbindungen verwenden.",
}: ByokAnnouncementTemplateProps) => (
	<Tailwind config={config}>
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body className="bg-background font-sans">
				<Container className="mx-auto py-12">
					<Section className="mt-8 rounded-md bg-muted p-px">
						<Section className="rounded-[5px] bg-card p-8">
							<Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
								Neu: Eigene API-Schlüssel in MDScribe
							</Text>
							<Text className="m-0 text-muted-foreground">Hallo,</Text>
							<Text className="text-muted-foreground">
								du kannst jetzt für freigeschaltete KI-Verbindungen deinen eigenen
								API-Schlüssel hinterlegen. Protokoll, Zieladresse und Modelle bleiben
								dabei sicher durch den Administrator vorgegeben.
							</Text>
							<Text className="text-muted-foreground">
								Aufrufe über deinen Schlüssel verbrauchen keine MDScribe-Quota. Kosten,
								Guthaben und Limits des jeweiligen KI-Anbieters gelten weiterhin für
								dein Provider-Konto.
							</Text>
							<Section className="mt-6 rounded-md border border-border bg-background p-4">
								<Text className="mt-0 mb-2 font-bold text-foreground text-lg">
									Write-only und optional
								</Text>
								<Text className="text-muted-foreground">
									Der Schlüssel wird verschlüsselt gespeichert und nach dem Speichern
									nicht wieder angezeigt. Du kannst ihn jederzeit deaktivieren,
									ersetzen oder vollständig löschen.
								</Text>
								<Button
									className="rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground text-sm"
									href={actionUrl}
								>
									{buttonText}
								</Button>
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
