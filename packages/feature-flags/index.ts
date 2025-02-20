import { auth } from '@repo/auth';
import { dedupe, flag } from '@vercel/flags/next';

interface Entities {
  user?: { id: string; email: string };
}

const identify = dedupe(
  async ({
    headers,
  }: {
    headers: Headers;
  }): Promise<Entities> => {
    const session = await auth.api.getSession({
      headers: await headers,
    });
    return {
      user: session?.user
        ? { id: session.user.id, email: session.user.email }
        : undefined,
    };
  }
);

export const showBetaFeature = flag<boolean, Entities>({
  key: 'showBetaFeature',
  identify,
  decide: ({ entities }) => {
    const user = entities?.user;

    return user?.email === 'nils.hapke@we-mail.de';
  },
});

export const allowAIUse = flag<boolean, Entities>({
  key: 'allowAIUse',
  identify,
  decide: ({ entities }) => {
    const user = entities?.user;

    return (
      user?.email === 'n.hapke@bbtgruppe.de' ||
      process.env.NODE_ENV === 'development'
    );
  },
});
