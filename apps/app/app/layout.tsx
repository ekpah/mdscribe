import { auth } from '@/auth';
import '@/lib/orpc.server'; // for pre-rendering
import { DesignSystemProvider } from '@repo/design-system/providers';
import '@repo/design-system/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';
import Menubar from './_components/Menubar';
import { PostHogProvider } from './providers/posthogProvider';
import QueryProvider from './providers/queryProvider';

export const metadata: Metadata = {
  title: 'MDScribe',
  description: 'A powerful, flexible, Markdown-based authoring framework',
};

// If loading a variable font, you don't need to specify the font weight
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

type RootLayoutProperties = {
  readonly children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProperties) {
  // Check if user is logged in
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const showAiLink = !!session?.user;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
        <meta content="strict-origin" name="referrer" />

        <link href="/favicon.ico" rel="shortcut icon" />
        <link href="/favicon.ico" rel="icon" />
      </head>
      <body
        className={`${inter.variable} items-center bg-background font-sans text-foreground`}
      >
        <NuqsAdapter>
          <QueryProvider>
            <PostHogProvider>
              <DesignSystemProvider>
                <div className="flex h-screen w-screen" key="Body">
                  <nav className="fixed top-0 right-0 bottom-[calc(100vh-(--spacing(16)))] left-0 z-30 h-16">
                    {/*ModeWatcher track="true" />*/}
                    <Menubar showAiLink={showAiLink} />
                  </nav>
                  <div
                    className="sticky top-16 flex h-[calc(100vh-(--spacing(16)))] w-full items-center justify-center"
                    key="Content"
                  >
                    {children}
                  </div>
                </div>
              </DesignSystemProvider>
            </PostHogProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
