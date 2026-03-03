'use client';

import { ClipboardCheck } from 'lucide-react';
import { AiscribeTemplate } from '../_components/aiscribe-template';
import type { AiscribeTemplateConfig } from '../_components/aiscribe-template';

const PROCEDURES_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Eingriffsdokumentation',
  description:
    'Erstellen Sie professionelle Dokumentationen für medizinische Eingriffe und Prozeduren',
  icon: ClipboardCheck,

  // Document type for oRPC
  documentType: 'procedures',

  // Tab configuration
  inputTabTitle: 'Eingriffsnotizen',
  outputTabTitle: 'Eingriffsdokumentation',

  // Form configuration
  inputFieldName: 'notes',
  inputPlaceholder: 'Geben Sie hier Ihre Notizen zum Eingriff ein...',
  inputDescription:
    'Dokumentieren Sie den Ablauf, die verwendeten Materialien und Ergebnisse des Eingriffs',

  // Button text
  generateButtonText: 'Dokumentation generieren',
  regenerateButtonText: 'Neu generieren',

  // Empty state messages
  emptyStateTitle: 'Noch keine Eingriffsdokumentation vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst Eingriffsnotizen ein und generieren Sie eine Dokumentation.',

};

export default function ProceduresAIGenerator() {
  return <AiscribeTemplate config={PROCEDURES_CONFIG} />;
}
