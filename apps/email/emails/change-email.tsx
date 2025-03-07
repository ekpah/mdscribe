import { EmailChangeTemplate } from '@repo/email/templates/change-email';

const ExampleVerifyEmail = () => (
  <EmailChangeTemplate url="https://example.com" newEmail="test@example.com" />
);

export default ExampleVerifyEmail;
