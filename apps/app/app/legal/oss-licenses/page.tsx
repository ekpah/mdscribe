'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/design-system/components/ui/accordion';
import { Badge } from '@repo/design-system/components/ui/badge';
import { ExternalLink, Package } from 'lucide-react';

type LicenseGroup = {
  license: string;
  description: string;
  url: string;
  packages: string[];
};

const licenseGroups: LicenseGroup[] = [
  {
    license: 'MIT',
    description:
      'Eine permissive Lizenz, die die Wiederverwendung mit minimalen Einschränkungen erlaubt.',
    url: 'https://opensource.org/licenses/MIT',
    packages: [
      '@babel/code-frame',
      '@babel/generator',
      '@babel/parser',
      '@babel/template',
      '@babel/traverse',
      '@babel/types',
      '@better-auth/stripe',
      '@better-auth/utils',
      '@floating-ui/core',
      '@floating-ui/dom',
      '@floating-ui/react-dom',
      '@harshtalks/slash-tiptap',
      '@hookform/resolvers',
      '@markdoc/markdoc',
      '@markdoc/next.js',
      '@next/bundle-analyzer',
      '@orpc/client',
      '@orpc/server',
      '@orpc/tanstack-query',
      '@radix-ui/react-dialog',
      '@radix-ui/react-icons',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@react-email/components',
      '@tailwindcss/postcss',
      '@tailwindcss/typography',
      '@tanstack/react-query',
      '@tiptap/core',
      '@tiptap/extension-underline',
      '@tiptap/extensions',
      '@tiptap/markdown',
      '@tiptap/pm',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'better-auth',
      'class-variance-authority',
      'clsx',
      'diff',
      'flags',
      'fparser',
      'jiti',
      'jotai',
      'langfuse',
      'lodash',
      'lucide-react',
      'nanoid',
      'next',
      'next-secure-headers',
      'next-themes',
      'nuqs',
      'pdf-lib',
      'posthog-js',
      'postmark',
      'prosemirror-changeset',
      'prosemirror-collab',
      'prosemirror-commands',
      'prosemirror-dropcursor',
      'prosemirror-gapcursor',
      'prosemirror-history',
      'prosemirror-inputrules',
      'prosemirror-keymap',
      'prosemirror-markdown',
      'prosemirror-model',
      'prosemirror-schema-basic',
      'prosemirror-schema-list',
      'prosemirror-state',
      'prosemirror-tables',
      'prosemirror-transform',
      'prosemirror-view',
      'radix-ui',
      'react',
      'react-aria-components',
      'react-dom',
      'react-hook-form',
      'react-hotkeys-hook',
      'react-pdf',
      'sonner',
      'stripe',
      'tailwind-merge',
      'tailwindcss',
      'tailwindcss-animate',
      'zod',
    ],
  },
  {
    license: 'Apache-2.0',
    description:
      'Eine permissive Lizenz, die auch eine ausdrückliche Gewährung von Patentrechten beinhaltet.',
    url: 'https://opensource.org/licenses/Apache-2.0',
    packages: [
      '@ai-sdk/anthropic',
      '@ai-sdk/provider',
      '@ai-sdk/provider-utils',
      '@ai-sdk/react',
      '@internationalized/date',
      '@openrouter/ai-sdk-provider',
      '@opentelemetry/api',
      '@prisma/adapter-neon',
      '@prisma/client',
      '@react-aria/button',
      '@react-aria/calendar',
      '@react-aria/checkbox',
      '@react-aria/collections',
      '@react-aria/combobox',
      '@react-aria/datepicker',
      '@react-aria/dialog',
      '@react-aria/dnd',
      '@react-aria/focus',
      '@react-aria/form',
      '@react-aria/grid',
      '@react-aria/i18n',
      '@react-aria/interactions',
      '@react-aria/label',
      '@react-aria/listbox',
      '@react-aria/menu',
      '@react-aria/overlays',
      '@react-aria/selection',
      '@react-aria/ssr',
      '@react-aria/utils',
      '@react-stately/calendar',
      '@react-stately/collections',
      '@react-stately/combobox',
      '@react-stately/datepicker',
      '@react-stately/form',
      '@react-stately/list',
      '@react-stately/menu',
      '@react-stately/overlays',
      '@react-stately/selection',
      '@react-stately/utils',
      '@swc/helpers',
      '@vercel/speed-insights',
      '@vercel/toolbar',
      'ai',
      'fuse.js',
      'prisma',
      'react-aria',
      'react-stately',
      'typescript',
    ],
  },
  {
    license: 'ISC',
    description:
      'Eine funktional äquivalente, aber einfachere Version der MIT-Lizenz.',
    url: 'https://opensource.org/licenses/ISC',
    packages: [
      'fastq',
      'glob-parent',
      'graceful-fs',
      'knip',
      'lru-cache',
      'lucide-react',
      'minipass',
      'semver',
      'signal-exit',
      'yaml',
    ],
  },
  {
    license: 'BSD-3-Clause',
    description:
      'Eine permissive Lizenz mit einer Nicht-Befürwortungsklausel.',
    url: 'https://opensource.org/licenses/BSD-3-Clause',
    packages: [
      'diff',
      'intl-messageformat',
      'qs',
      'secure-json-parse',
      'source-map',
      'source-map-js',
    ],
  },
  {
    license: 'BSD-2-Clause',
    description:
      'Eine vereinfachte Version der BSD-3-Clause ohne Nicht-Befürwortungsklausel.',
    url: 'https://opensource.org/licenses/BSD-2-Clause',
    packages: [
      'domelementtype',
      'domhandler',
      'domutils',
      'dotenv',
      'entities',
      'terser',
    ],
  },
  {
    license: 'MPL-2.0',
    description:
      'Eine schwache Copyleft-Lizenz, die einen Mittelweg zwischen permissiven und Copyleft-Lizenzen bietet.',
    url: 'https://opensource.org/licenses/MPL-2.0',
    packages: ['@vercel/analytics', 'lightningcss'],
  },
  {
    license: '0BSD',
    description:
      'Eine noch permissivere Variante der BSD-Lizenz ohne Einschränkungen.',
    url: 'https://opensource.org/licenses/0BSD',
    packages: ['tslib'],
  },
  {
    license: 'BlueOak-1.0.0',
    description:
      'Eine moderne, leicht verständliche permissive Lizenz.',
    url: 'https://blueoakcouncil.org/license/1.0.0',
    packages: ['glob', 'jackspeak', 'minimatch', 'path-scurry'],
  },
  {
    license: 'Unlicense',
    description:
      'Eine gemeinfreie Lizenzvorlage, die keine Bedingungen für die Nutzung stellt.',
    url: 'https://unlicense.org/',
    packages: ['postgres'],
  },
];

export default function OSSLicensesPage() {
  const totalPackages = licenseGroups.reduce(
    (acc, group) => acc + group.packages.length,
    0
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="font-semibold text-xl">Open Source Lizenzen</h2>
        <p className="text-muted-foreground">
          mdscribe.de verwendet Open Source Software. Wir sind den Entwicklern
          und Maintainern dieser Projekte dankbar für ihre Arbeit. Diese Seite
          listet die verwendeten Open Source Pakete und ihre jeweiligen
          Lizenzen auf.
        </p>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">
            Insgesamt {totalPackages}+ Open Source Pakete
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-solarized-blue bg-solarized-base3 p-4 dark:border-solarized-cyan dark:bg-solarized-base02">
        <p className="text-sm text-solarized-base01 dark:text-solarized-base1">
          Diese Liste ist nicht vollständig und enthält nur die wichtigsten
          direkten Abhängigkeiten. Die vollständige Liste aller transitiven
          Abhängigkeiten umfasst über 1000 Pakete.
        </p>
      </div>

      <Accordion className="space-y-2" type="multiple">
        {licenseGroups.map((group) => (
          <AccordionItem
            key={group.license}
            className="rounded-lg border px-4"
            value={group.license}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{group.license}</Badge>
                <span className="text-muted-foreground text-sm">
                  ({group.packages.length} Pakete)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <p className="text-muted-foreground text-sm">
                  {group.description}
                </p>
                <a
                  className="inline-flex items-center gap-1 text-solarized-blue text-sm hover:underline dark:text-solarized-cyan"
                  href={group.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Lizenztext anzeigen
                  <ExternalLink className="h-3 w-3" />
                </a>
                <div className="flex flex-wrap gap-2 pt-2">
                  {group.packages.map((pkg) => (
                    <Badge
                      key={pkg}
                      className="font-mono text-xs"
                      variant="outline"
                    >
                      {pkg}
                    </Badge>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="space-y-4 border-t pt-8">
        <h3 className="font-semibold text-lg">Lizenzhinweise</h3>
        <div className="space-y-4 text-muted-foreground text-sm">
          <p>
            Die Verwendung dieser Open Source Software erfolgt in
            Übereinstimmung mit den jeweiligen Lizenzbedingungen. Für
            detaillierte Informationen zu den einzelnen Lizenzen besuchen Sie
            bitte die entsprechenden Lizenzlinks.
          </p>
          <p>
            Falls Sie Fragen zu den verwendeten Open Source Komponenten haben,
            kontaktieren Sie uns bitte unter{' '}
            <a
              className="text-solarized-blue hover:underline dark:text-solarized-cyan"
              href="mailto:support@mdscribe.de"
            >
              support@mdscribe.de
            </a>
            .
          </p>
        </div>
      </section>

      <section className="space-y-4 border-t pt-8">
        <h3 className="font-semibold text-lg">Haupttechnologien</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Frontend</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              <li>React – Benutzeroberflächen-Bibliothek</li>
              <li>Next.js – React Framework</li>
              <li>Tailwind CSS – Styling</li>
              <li>Radix UI – Barrierefreie UI-Komponenten</li>
              <li>TipTap – Rich Text Editor</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Backend</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              <li>Prisma – Datenbank ORM</li>
              <li>better-auth – Authentifizierung</li>
              <li>Stripe – Zahlungsabwicklung</li>
              <li>oRPC – Typsichere API</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">KI & Dokumentation</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              <li>Vercel AI SDK – KI-Integration</li>
              <li>Markdoc – Dokumentenformat</li>
              <li>Langfuse – KI-Monitoring</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Entwicklung</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
              <li>TypeScript – Typsichere Programmierung</li>
              <li>Turbo – Monorepo Build-System</li>
              <li>Biome – Linting & Formatierung</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
