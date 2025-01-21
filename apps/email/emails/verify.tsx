import { EmailVerificationTemplate } from '@repo/email/templates/verify';

const ExampleVerifyEmail = () => (
  <EmailVerificationTemplate actionUrl="https://example.com" />
);

export default ExampleVerifyEmail;
