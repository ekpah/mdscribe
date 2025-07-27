import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import config from '../tailwind.config';

interface ResetPasswordTemplateProps {
  readonly url: string;
}

export const ResetPasswordTemplate = ({ url }: ResetPasswordTemplateProps) => (
  <Tailwind config={config}>
    <Html>
      <Head />
      <Preview>Setzen Sie Ihr Passwort zurück</Preview>
      <Body className="bg-background font-sans">
        <Container className="mx-auto py-12">
          <Section className="mt-8 rounded-md bg-muted p-px">
            <Section className="rounded-[5px] bg-card p-8">
              <Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
                Setzen Sie Ihr Passwort zurück
              </Text>
              <Text className="m-0 text-muted-foreground">
                Klicken Sie auf den Button unten, um Ihr Passwort
                zurückzusetzen. Wenn Sie diese Anfrage nicht gestellt haben,
                können Sie diese E-Mail ignorieren.
              </Text>
              <Hr className="my-4" />
              <Button
                href={url}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                Passwort zurücksetzen
              </Button>
              <Hr className="my-4" />
              <Text className="m-0 text-muted-foreground">
                Falls Du den Button nicht anklicken kannst, kopiere diesen Link
                in Deinen Browser: <Link href={url}>{url}</Link>
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

