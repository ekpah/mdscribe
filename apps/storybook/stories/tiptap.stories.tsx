import TipTap from '@repo/design-system/components/editor/TipTap';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  title: 'Components/Editor/TipTap',
  component: TipTap,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TipTap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    note: `## Anamnese
Die notfallmäßige Vorstellung erfolgt bei Synkope heute XXX.

Risikofaktoren nach San Francisco Syncope Rule:  
C: Keine bekannte Herzerkrankung  
H: Hb {% info "Hb" /%} g/dl  
E: Keine EKG-Auffälligkeiten, insb kein H.a.:
- Kein H.a. WPW (Deltawelle oder PQ <120ms)
- Kein AV-Block II° oder III°
- Kein höhergradiger/neuer Block (bi-/trifaszikulärer Block, neuer LSB/RSB)
- Kein H.a. Brugada-Syndrom
- Keine linksventrikuläre Hypertrophie
- Keine Epsilon-Wave (bei arrhythmogener rechtsventrikulärer Kardiomyopathie ARVCM)
- Keine Repolarisationsstörung (inbesondere kein Long-QT-Syndrom; QTc {% info "QTc" /%}ms)
- Keine elektrokardiographischen Zeichen der akuten Rechtsherzbelastung

S: RR bei Triage {% info "RR" /%} mmHg  
S: Keine Dyspnoe vor oder nach Synkope

EKG:
Sinusrhythmus, XX/min, Delta-Welle, prominente P-Welle in II, III, keine ST-Streckenveränderungen, kein ERBST, Zeiten in der Norm

Vitalparameter:
RR 138/90 mmHg, Puls 75/min, SpO2 99%, AF 14/min, Temperatur 37,4°C, Blutzucker 118 mg/dl

## Zusammenfassung
Die notfallmäßige Vorstellung erfolgt bei Synkope XXX
`,
    setContent: (content: string) => {
      // console.log('Content updated:', content);
    },
  },
};

export const Empty: Story = {
  args: {
    note: '',
    setContent: (content: string) => {
      // console.log('Content updated:', content);
    },
  },
};
