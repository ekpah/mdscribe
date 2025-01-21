import {
  Body,
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

interface OTPLoginTemplateProps {
  readonly otpCode: string;
  readonly headline?: string;
  readonly text?: string;
  readonly expiryTime?: string;
}

export const OTPLoginTemplate = ({
  otpCode,
  headline = 'Dein Login-Code',
  text = 'Verwende den folgenden Code, um dich anzumelden:',
  expiryTime,
}: OTPLoginTemplateProps) => (
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
              <Text className="m-0 text-muted-foreground">{text}</Text>
              <Hr className="my-4" />
              <Text className="text-center font-bold font-mono text-3xl text-primary tracking-widest">
                {otpCode}
              </Text>
              {expiryTime && (
                <Text className="mt-4 text-center text-muted-foreground text-sm">
                  Dieser Code ist gültig für {expiryTime}
                </Text>
              )}
              <Hr className="my-4" />
              <Text className="m-0 text-muted-foreground text-sm">
                Falls du diesen Code nicht angefordert hast, kannst du diese
                E-Mail ignorieren.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

export default OTPLoginTemplate;
