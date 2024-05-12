import Menubar from "@/components/navigation/Menubar";
import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import Link from "next/link";
import Providers from "./providers";
const title = "Markdoc";
const description = "A powerful, flexible, Markdown-based authoring framework";

export const metadata: Metadata = {
  title: "My Page Title",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="referrer" content="strict-origin" />
        <meta name="title" content={title} />
        <meta name="description" content={description} />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" />
        <script
          async
          src="https://eu.umami.is/script.js"
          data-website-id="8cfcabe5-4485-4904-95ba-95a39e09e2dd"
        ></script>
      </head>
      <body>
        <Providers>
          <div key="Body" className="h-screen w-screen flex">
            <nav className="fixed bottom-[calc(100vh-theme(spacing.16))] left-0 right-0 top-0 z-30 flex-none bg-blue-200">
              {/*ModeWatcher track="true" />*/}
              <Menubar />
            </nav>
            <div
              key="Content"
              className="sticky mt-16 h-[calc(100vh-theme(spacing.16))]"
            >
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
