'use client';

import { Stethoscope } from 'lucide-react';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

const ICU_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'ICU Verlegungsbrief',
  description:
    'Erstellen Sie professionelle Verlegungsbriefe für Ihre ICU-Patienten',
  icon: Stethoscope,

  // API configuration
  apiEndpoint: '/api/scribe/icu/transfer/stream',

  // Tab configuration
  inputTabTitle: 'Patientennotizen',
  outputTabTitle: 'Verlegungsbrief',

  // Form configuration
  inputFieldName: 'patientNotes',
  inputPlaceholder: 'Geben Sie hier Ihre Notizen zum Patienten ein...',
  inputDescription:
    'Dokumentieren Sie den Zustand und die Behandlung des Patienten während des ICU-Aufenthalts',
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
  generateButtonText: 'Verlegungsbrief generieren',
  regenerateButtonText: 'Neu generieren',

  // Empty state messages
  emptyStateTitle: 'Noch kein Verlegungsbrief vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst Patientennotizen ein und generieren Sie einen Verlegungsbrief.',
};

export default function ICUPage() {
  return <AiscribeTemplate config={ICU_CONFIG} />;
}
