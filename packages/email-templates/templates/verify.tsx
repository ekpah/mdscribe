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

type EmailVerificationTemplateProps = {
  readonly actionUrl: string;
  readonly headline: string;
  readonly text: string;
  readonly buttonText: string;
};

export const EmailVerificationTemplate = ({
  actionUrl,
  headline,
  text,
  buttonText,
}: EmailVerificationTemplateProps) => (
  <Tailwind>
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
              <Text className="m-0 text-muted-foreground">{text}</Text>
              <Hr className="my-4" />
              <Button
                href={actionUrl}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                {buttonText}
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

export default EmailVerificationTemplate;
