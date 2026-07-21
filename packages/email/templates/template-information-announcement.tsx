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

interface TemplateInformationAnnouncementTemplateProps {
	readonly actionUrl: string;
	readonly buttonText?: string;
	readonly previewText?: string;
}

export const TemplateInformationAnnouncementTemplate = ({
	actionUrl,
	buttonText = "Informationen hinzufügen",
	previewText = "Ausfüllhinweise und KI-Vorgaben direkt an Templates und Dokumenten hinterlegen.",
}: TemplateInformationAnnouncementTemplateProps) => (
	<Tailwind config={config}>
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body className="bg-background font-sans">
				<Container className="mx-auto py-12">
					<Section className="mt-8 rounded-md bg-muted p-px">
						<Section className="rounded-[5px] bg-card p-8">
							<Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
								Neu: Klare Vorgaben für Templates und Dokumente
							</Text>
							<Text className="m-0 text-muted-foreground">Hallo,</Text>
							<Text className="text-muted-foreground">
								mit dem neuen Feld <strong>Informationen</strong> kannst du direkt an einem Template
								festlegen, wie die KI es ausfüllen soll. Die Vorgaben werden als Anweisungen
								berücksichtigt, ohne selbst im erzeugten Text zu erscheinen.
							</Text>
							<Text className="text-muted-foreground">
								Auch PDF-Dokumente können jetzt allgemeine Ausfüllhinweise enthalten. Nutzer sehen
								sie getrennt von den Formularfeldern; beim automatischen Ausfüllen berücksichtigt
								die KI diese Vorgaben ebenfalls.
							</Text>
							<Button
								className="rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground text-sm"
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
