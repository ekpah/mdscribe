import { EmailVerificationTemplate } from '@repo/email-templates/templates/verify';

const ExampleVerifyEmail = () => (
  <EmailVerificationTemplate
    actionUrl="https://example.com"
    headline="Bestätigen Sie Ihre E-Mail-Adresse"
    text="Klicken Sie auf den Button unten, um Ihre E-Mail-Adresse zu bestätigen und Ihr Konto zu aktivieren."
    buttonText="E-Mail bestätigen"
  />
);

export default ExampleVerifyEmail;
