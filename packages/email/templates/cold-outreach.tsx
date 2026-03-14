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
} from '@react-email/components';
import config from '../tailwind.config';

interface ColdOutreachTemplateProps {
    readonly userName: string;
    readonly actionUrl: string;
    readonly headline?: string;
    readonly buttonText?: string;
}

export const ColdOutreachTemplate = ({
    userName,
    actionUrl,
    headline = '🚀 70% weniger Dokumentationsarbeit – KI für Assistenzärzte',
    buttonText = 'Jetzt kostenlos starten',
}: ColdOutreachTemplateProps) => (
    <Tailwind config={config}>
        <Html>
            <Head />
            <Preview>{headline}</Preview>
            <Body className="bg-background font-sans">
                <Container className="mx-auto py-12">
                    <Section className="mt-8 rounded-md bg-muted p-px">
                        <Section className="rounded-[5px] bg-card p-8">
                            <Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
                                {headline}
                            </Text>
                            <Text className="m-0 text-muted-foreground">
                                Hey {userName} 👋
                            </Text>
                            <Text className="text-muted-foreground">
                                Du verbringst wahrscheinlich 3-4 Stunden täglich mit
                                Dokumentation. Was wäre, wenn du diese Zeit für deine Patienten
                                nutzen könntest?
                            </Text>
                            <Text className="text-muted-foreground">
                                <strong>MDScribe</strong> ist die KI-Lösung für Assistenzärzte, um ihre Dokumentation zu revolutionieren.
                            </Text>
                            <Text className='font-bold text-lg text-muted-foreground'>
                                Was du bekommst:
                            </Text>
                            <Text className="text-muted-foreground">⚡ <strong>70% Zeitersparnis</strong> bei Arztbriefen & Berichten</Text>
                            <Text className="text-muted-foreground">📋 <strong>Intelligente Vorlagen</strong> für alle Fachbereiche</Text>
                            <Text className="text-muted-foreground">🤖 <strong>KI-generierte Entlassbriefe</strong> automatisch aus Befunden erstellt</Text>
                            <Text className="text-muted-foreground">
                                <strong>Kostenlos testen</strong> - keine Kreditkarte
                                erforderlich. Starte noch heute!
                            </Text>
                            <Hr className="my-4" />
                            <Button
                                className='rounded-md bg-primary px-6 py-3 font-semibold text-lg text-primary-foreground'
                                href={actionUrl}
                            >
                                {buttonText}
                            </Button>
                            <Hr className="my-4" />
                            <Text className="m-0 text-muted-foreground text-sm">
                                Beste Grüße,
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
