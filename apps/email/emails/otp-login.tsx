import { OTPLoginTemplate } from '@repo/email/templates/otp-login';

const ExampleOTPLoginEmail = () => (
  <OTPLoginTemplate
    otpCode="123456"
    headline="Ihr Login-Code"
    text="Verwenden Sie den folgenden Code, um sich anzumelden:"
    expiryTime="10 Minuten"
  />
);

export default ExampleOTPLoginEmail;
