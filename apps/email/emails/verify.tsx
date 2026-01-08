import { EmailVerificationTemplate } from '@repo/email/templates/verify';

const ExampleVerifyEmail = () => (
  <EmailVerificationTemplate url="https://example.com/verify?token=abc123" />
);

export default ExampleVerifyEmail;
