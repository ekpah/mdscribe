import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/');
  }

  if (session.user.email !== 'nils.hapke@we-mail.de') {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-solarized-base3">
      <div className="border-solarized-base2 border-b bg-solarized-base2 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-lg text-solarized-base00">
              Admin Panel
            </h1>
            <p className="text-sm text-solarized-base01">
              Administrative tools and utilities
            </p>
          </div>
          <div className="text-sm text-solarized-base01">
            Logged in as:{' '}
            <span className="font-medium">{session.user.email}</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
