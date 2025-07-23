'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useTRPC } from '@/lib/trpc';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

export default function ERAIGenerator() {
  const trpc = useTRPC();
  const userQuery = useQuery(trpc.session.queryOptions({ text: 'bilbo' }));

  const DOC_CONFIG: AiscribeTemplateConfig = {
    // Page identity
    title: userQuery.data?.greeting || 'sampleQuery',
    description:
      'Erstellen Sie professionelle Anamnese-Dokumentation für Notfallpatienten',
    icon: Heart,

    // API configuration
    apiEndpoint: '/api/scribe/anamnese/stream',

    // Tab configuration
    inputTabTitle: 'Anamnese',
    outputTabTitle: 'Analyse',

    // Form configuration
    inputFieldName: 'anamnese',
    inputPlaceholder: 'Geben Sie hier die Anamnese des Patienten ein...',
    inputDescription:
      'Dokumentieren Sie die Symptome, Beschwerden und relevante Vorgeschichte des Patienten',

    // Additional input fields
    additionalInputs: [
      {
        name: 'vordiagnosen',
        label: 'Vordiagnosen',
        placeholder: 'Bekannte Vorerkrankungen und Diagnosen eingeben...',
        required: false,
        type: 'textarea',
        description:
          'Bekannte Vorerkrankungen, chronische Leiden, bisherige Diagnosen',
      },
    ],

    // Button text
    generateButtonText: 'Analyse generieren',
    regenerateButtonText: 'Neu analysieren',

    // Empty state messages
    emptyStateTitle: 'Noch keine Analyse vorhanden',
    emptyStateDescription:
      'Bitte geben Sie zuerst die Anamnese ein und generieren Sie eine Analyse.',
  };

  return <AiscribeTemplate config={DOC_CONFIG} />;
}
