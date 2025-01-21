import { WelcomeTemplate } from '@repo/email/templates/welcome';

const ExampleWelcomeEmail = () => (
  <WelcomeTemplate
    userName="Max Mustermann"
    actionUrl="https://example.com/dashboard"
    headline="Willkommen bei uns!"
    buttonText="Zum Dashboard"
  />
);

export default ExampleWelcomeEmail;
