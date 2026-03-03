'use client';

import { Heart } from 'lucide-react';
import { AiscribeTemplate } from '../_components/AiscribeTemplate';
import type { AiscribeTemplateConfig } from '../_components/AiscribeTemplate';

const ER_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Notfall Anamnese',
  description:
    'Erstellen Sie professionelle Anamnese-Dokumentation für Notfallpatienten',
  icon: Heart,

  // Document type for oRPC
  documentType: 'anamnese',

  // Tab configuration
  inputTabTitle: 'Anamnese',
  outputTabTitle: 'Analyse',

  // Form configuration
  inputFieldName: 'notes',
  inputPlaceholder: 'Geben Sie hier die Anamnese des Patienten ein...',
  inputDescription:
    'Dokumentieren Sie die Symptome, Beschwerden und relevante Vorgeschichte des Patienten',

  // Additional input fields
  additionalInputs: [
    {
      description:
        'Bekannte Vorerkrankungen, chronische Leiden, bisherige Diagnosen',
      label: 'Vordiagnosen',
      name: 'diagnoseblock',
      placeholder: 'Bekannte Vorerkrankungen und Diagnosen eingeben...',
      required: false,
      type: 'textarea',
    },
    {
      description:
        'Chronologische Auflistung aller Untersuchungen, Konsile und wichtigen Einträge während der Notaufnahme',
      label: 'Befunde',
      name: 'befunde',
      placeholder: 'Befunde aus der Notaufnahme eingeben...',
      required: false,
      type: 'textarea',
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

export default function ERAIGenerator() {
  return <AiscribeTemplate config={ER_CONFIG} />;
}
