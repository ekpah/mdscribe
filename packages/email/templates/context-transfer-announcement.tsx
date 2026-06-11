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

interface ContextTransferAnnouncementTemplateProps {
	readonly actionUrl: string;
	readonly buttonText?: string;
	readonly previewText?: string;
}

export const ContextTransferAnnouncementTemplate = ({
	actionUrl,
	buttonText = "AIScribe öffnen",
	previewText = "Kontext aus AIScribe sicher in Textbausteinen, AI Texten und Dokumenten weiterverwenden.",
}: ContextTransferAnnouncementTemplateProps) => (
	<Tailwind config={config}>
		<Html>
			<Head />
			<Preview>{previewText}</Preview>
			<Body className="bg-background font-sans">
				<Container className="mx-auto py-12">
					<Section className="mt-8 rounded-md bg-muted p-px">
						<Section className="rounded-[5px] bg-card p-8">
							<Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
								Neu: Kontext in MDScribe weiterverwenden
							</Text>
							<Text className="m-0 text-muted-foreground">Hallo,</Text>
							<Text className="text-muted-foreground">
								mit <strong>Weiterverwenden</strong> kannst du Eingaben und erzeugte
								Epikrisen direkt in einem passenden Textbaustein, AI Text oder Dokument
								weiter nutzen.
							</Text>
							<Text className="text-muted-foreground">
								Der Kontext wird dabei nicht in der URL gespeichert. MDScribe legt nur
								einen kurzlebigen, verschlüsselten Transfer ab; der Schlüssel bleibt im
								Browser und wird nur beim Öffnen des Ziels verwendet.
							</Text>
							<Section className="mt-6 rounded-md border border-border bg-background p-4">
								<Text className="mt-0 mb-2 font-bold text-foreground text-lg">
									Typische Nutzung
								</Text>
								<Text className="text-muted-foreground">
									Erstelle zuerst eine Anamnese oder Epikrise, wähle links{" "}
									<em>Weiterverwenden</em> und öffne danach den passenden Textbaustein
									oder AI Text mit bereits übernommenem Kontext.
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
