import { ResetPasswordTemplate } from '@repo/email-templates/templates/reset-password';

const ExampleResetPasswordEmail = () => (
  <ResetPasswordTemplate
    actionUrl="https://example.com"
    headline="Setzen Sie Ihr Passwort zurück"
    text="Klicken Sie auf den Button unten, um Ihr Passwort zurückzusetzen. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren."
    buttonText="Passwort zurücksetzen"
  />
);

export default ExampleResetPasswordEmail;
