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
