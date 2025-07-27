import { dedupe, flag } from 'flags/next';
import { auth } from './auth';

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

const showBetaFeature = flag<boolean, Entities>({
  key: 'showBetaFeature',
  identify,
  decide: ({ entities }) => {
    const user = entities?.user;

    return (
      user?.email === 'nils.hapke@we-mail.de' ||
      user?.email === 'n.hapke@bbtgruppe.de'
    );
  },
});

export const allowAIUse = flag<boolean, Entities>({
  key: 'allowAIUse',
  identify,
  decide: ({ entities }) => {
    const user = entities?.user;

    return (
      user?.email === 'n.hapke@bbtgruppe.de' ||
      process.env.NODE_ENV === 'development' ||
      user?.email === 'ochir0111@yahoo.com'
    );
  },
});

export const allowAdminAccess = flag<boolean, Entities>({
  key: 'allowAdminAccess',
  identify,
  decide: ({ entities }) => {
    const user = entities?.user;
    return (
      user?.email === 'nils.hapke@we-mail.de' ||
      user?.email === 'n.hapke@bbtgruppe.de'
    );
  },
});
