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

type EmailChangeTemplateProps = {
  readonly url: string;
  readonly newEmail: string;
};

export const EmailChangeTemplate = ({
  url,
  newEmail,
}: EmailChangeTemplateProps) => (
  <Tailwind config={config}>
    <Html>
      <Head />
      <Preview>Genehmige E-Mail-Änderung</Preview>
      <Body className="bg-background font-sans">
        <Container className="mx-auto py-12">
          <Section className="mt-8 rounded-md bg-muted p-px">
            <Section className="rounded-[5px] bg-card p-8">
              <Text className="mt-0 mb-4 font-semibold text-2xl text-foreground">
                Genehmige E-Mail-Änderung
              </Text>
              <Text className="m-0 text-muted-foreground">
                Es wurde eine E-Mail-Änderung auf die Adresse {newEmail}{' '}
                angefragt. Klicke auf den Button unten, um die Änderung der
                E-Mail-Adresse zu genehmigen.
              </Text>
              <Hr className="my-4" />
              <Button
                href={url}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                Neue E-Mail bestätigen
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

export default EmailChangeTemplate;
