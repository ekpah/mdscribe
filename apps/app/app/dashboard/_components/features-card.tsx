'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Zap } from 'lucide-react';

interface FeaturesCardProps {
  hasActiveSubscription: boolean;
  onUpgrade: () => void;
}

export function FeaturesCard({
  hasActiveSubscription,
  onUpgrade,
}: FeaturesCardProps) {
  const features = [
    'Unbegrenzt Textbausteine nutzen',
    'Favoriten-Bibliothek verwalten',
    'Benutzerdefinierte Vorlagen generieren',
    'Zeit im klinischen Alltag sparen',
    'Anamnesen mit KI generieren',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan-Funktionen</CardTitle>
        <CardDescription>
          Dein Professional-Plan enthält die folgenden Funktionen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center">
              <Zap className="mr-2 h-4 w-4 text-green-500" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="mt-auto">
        {!hasActiveSubscription && (
          <Button className="w-full" onClick={onUpgrade}>
            <Zap className="mr-2 h-4 w-4" />
            Hol dir Plus
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
