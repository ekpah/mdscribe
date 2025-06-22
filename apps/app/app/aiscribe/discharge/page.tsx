'use client';

import { FileCheck } from 'lucide-react';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

const DISCHARGE_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Entlassungsbrief',
  description:
    'Erstellen Sie professionelle Entlassungsbriefe für Ihre Patienten',
  icon: FileCheck,

  // API configuration
  apiEndpoint: '/api/scribe/discharge/stream',

  // Tab configuration
  inputTabTitle: 'Entlassungsnotizen',
  outputTabTitle: 'Entlassungsbrief',

  // Form configuration
  inputFieldName: 'dischargeNotes',
  inputPlaceholder: 'Geben Sie hier Ihre Entlassungsnotizen ein...',
  inputDescription:
    'Dokumentieren Sie den Krankheitsverlauf, die Behandlung und Empfehlungen für die Weiterbehandlung',

  // Button text
  generateButtonText: 'Entlassungsbrief generieren',
  regenerateButtonText: 'Neu generieren',

  // Empty state messages
  emptyStateTitle: 'Noch kein Entlassungsbrief vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst Entlassungsnotizen ein und generieren Sie einen Entlassungsbrief.',

  // Colors
  primaryColor: 'solarized-green',
  secondaryColor: 'solarized-cyan',
};

export default function DischargeAIGenerator() {
  return <AiscribeTemplate config={DISCHARGE_CONFIG} />;
}
