import { render } from '@react-email/components';
import postmark from 'postmark';
import type { ReactElement } from 'react';

if (!process.env.AUTH_POSTMARK_KEY) {
  throw new Error('AUTH_POSTMARK_KEY is not set');
}

const client = new postmark.ServerClient(process.env.AUTH_POSTMARK_KEY);

type SendEmailOptions = {
  from: string;
  to: string;
  subject: string;
  template: ReactElement;
};

export async function sendEmail({
  from,
  to,
  subject,
  template,
}: SendEmailOptions) {
  const htmlBody = await render(template);

  return client.sendEmail({
    From: from,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
  });
}
