'use client';

import { FileText } from 'lucide-react';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

const DIAGNOSEBLOCK_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Diagnoseblock Update',
  description:
    'Erstellen Sie aktualisierte Diagnoseblöcke basierend auf bestehenden Diagnosen',
  icon: FileText,

  // API configuration
  apiEndpoint: '/api/scribe/diagnosis/stream',

  // Tab configuration
  inputTabTitle: 'Patientennotizen',
  outputTabTitle: 'Diagnoseblock',

  // Form configuration
  inputFieldName: 'notes',
  inputPlaceholder: 'Geben Sie hier Ihre Notizen zum aktuellen Besuch ein...',
  inputDescription:
    'Dokumentieren Sie den aktuellen Zustand und neue Befunde des Patienten',
  // Additional input fields
  additionalInputs: [
    {
      name: 'diagnoseblock',
      label: 'Diagnoseblock',
      placeholder: 'Diagnoseblock eingeben...',
      required: false,
      type: 'textarea',
      description:
        'Diagnoseblock des aktuellen Arztbriefes inkl. aktueller Diagnose und Vorerkrankungen (chronische Erkrankungen, Z.n. Operationen etc.)',
    },
    {
      name: 'anamnese',
      label: 'Aufnahmeanamnese',
      placeholder: 'Initiale Anamnese bei Aufnahme eingeben...',
      required: false,
      type: 'textarea',
      description:
        'Anamnese bei Aufnahme inkl. Aufnahmegrund und initiale Verdachtsdiagnose',
    },
    {
      name: 'befunde',
      label: 'Befunde',
      placeholder: 'Befunde aus dem stationären Aufenthalt eingeben...',
      required: false,
      type: 'textarea',
      description:
        'Chronologische Auflistung aller Untersuchungen, Konsile und wichtigen Einträge während des Aufenthalts',
    },
  ],
  // Button text
  generateButtonText: 'Diagnoseblock generieren',
  regenerateButtonText: 'Neu generieren',

  // Empty state messages
  emptyStateTitle: 'Noch kein Diagnoseblock vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst Patientennotizen ein und generieren Sie einen aktualisierten Diagnoseblock.',
};

export default function DiagnoseblockPage() {
  return <AiscribeTemplate config={DIAGNOSEBLOCK_CONFIG} />;
}
