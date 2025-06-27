'use client';

import { Stethoscope } from 'lucide-react';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

const OUTPATIENT_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Ambulanter Arztbrief',
  description:
    'Erstellen Sie professionelle Arztbriefe für Ihre ambulanten Patienten',
  icon: Stethoscope,

  // API configuration
  apiEndpoint: '/api/scribe/outpatient/stream',

  // Tab configuration
  inputTabTitle: 'Konsultationsnotizen',
  outputTabTitle: 'Arztbrief',

  // Form configuration
  inputFieldName: 'consultationNotes',
  inputPlaceholder: 'Geben Sie hier Ihre Notizen zur Konsultation ein...',
  inputDescription:
    'Dokumentieren Sie den Verlauf und die Ergebnisse der ambulanten Konsultation',

  // Button text
  generateButtonText: 'Arztbrief generieren',
  regenerateButtonText: 'Neu generieren',

  // Empty state messages
  emptyStateTitle: 'Noch kein Arztbrief vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst Ihre Konsultationsnotizen ein und generieren Sie einen Arztbrief.',
};

export default function OutpatientPage() {
  return <AiscribeTemplate config={OUTPATIENT_CONFIG} />;
}
