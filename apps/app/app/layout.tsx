import '@/public/globals.css';

import { DesignSystemProvider } from '@repo/design-system/providers';
import '@repo/design-system/styles/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import Menubar from './_components/Menubar';

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

export default function RootLayout({ children }: RootLayoutProperties) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="referrer" content="strict-origin" />

        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} items-center font-sans`}>
        <DesignSystemProvider>
          <div key="Body" className="flex h-screen w-screen">
            <nav className="fixed top-0 right-0 bottom-[calc(100vh-theme(spacing.16))] left-0 z-30 h-16">
              {/*ModeWatcher track="true" />*/}
              <Menubar />
            </nav>
            <div
              key="Content"
              className="sticky top-16 flex h-[calc(100vh-theme(spacing.16))] w-full items-center justify-center"
            >
              {children}
            </div>
          </div>
        </DesignSystemProvider>
      </body>
    </html>
  );
}
