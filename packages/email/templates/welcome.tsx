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

interface WelcomeTemplateProps {
  readonly userName: string;
  readonly actionUrl: string;
  readonly headline?: string;
  readonly buttonText?: string;
}

export const WelcomeTemplate = ({
  userName,
  actionUrl,
  headline = 'Willkommen bei uns!',
  buttonText = 'Zum Dashboard',
}: WelcomeTemplateProps) => (
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
                Hallo {userName},
              </Text>
              <Text className="text-muted-foreground">
                wir freuen uns sehr, Dich bei uns begrüßen zu dürfen! Dein Konto
                wurde erfolgreich erstellt und verifiziert.
              </Text>
              <Text className="text-muted-foreground">
                Du kannst jetzt alle Funktionen unserer Plattform nutzen. Bei
                Fragen stehen wir Dir jederzeit zur Verfügung.
              </Text>
              <Hr className="my-4" />
              <Button
                href={actionUrl}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
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

export default WelcomeTemplate;
