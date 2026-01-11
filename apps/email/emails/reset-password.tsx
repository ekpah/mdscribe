import { ResetPasswordTemplate } from '@repo/email/templates/reset-password';

const ExampleResetPasswordEmail = () => (
  <ResetPasswordTemplate url="https://example.com/reset-password?token=abc123" />
);

export default ExampleResetPasswordEmail;
