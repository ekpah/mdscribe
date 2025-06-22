'use client';

import { Heart } from 'lucide-react';
import {
  AiscribeTemplate,
  type AiscribeTemplateConfig,
} from '../_components/AiscribeTemplate';

const ER_CONFIG: AiscribeTemplateConfig = {
  // Page identity
  title: 'Notfall Anamnese',
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

  // Button text
  generateButtonText: 'Analyse generieren',
  regenerateButtonText: 'Neu analysieren',

  // Empty state messages
  emptyStateTitle: 'Noch keine Analyse vorhanden',
  emptyStateDescription:
    'Bitte geben Sie zuerst die Anamnese ein und generieren Sie eine Analyse.',

  // Colors
  primaryColor: 'solarized-red',
  secondaryColor: 'solarized-orange',

  // Custom API call for diagnosis
  customApiCall: async (inputData: string) => {
    const prompt = JSON.stringify({ anamnese: inputData });
    const response = await fetch('/api/scribe/diagnosis', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    return data.text;
  },
};

export default function ERAIGenerator() {
  return <AiscribeTemplate config={ER_CONFIG} />;
}
