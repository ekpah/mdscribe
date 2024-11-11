'use client';
import { Button } from '@repo/design-system/components/ui/button';
import { Card } from '@repo/design-system/components/ui/card';
import { Label } from '@repo/design-system/components/ui/label';
import {} from '@repo/design-system/components/ui/select';
import { Skeleton } from '@repo/design-system/components/ui/skeleton';
import {} from '@repo/design-system/components/ui/tabs';
import {} from 'react';

export default function SkeletonEditor() {
  return (
    <Card className="flex flex-col gap-4 h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] w-full overflow-y-auto p-4">
      <div className="grow gap-2">
        <div className="flex flex-col grow md:flex-row gap-2">
          <div className="flex-1 w-full">
            <Label htmlFor="category">Kategorie</Label>
            <Skeleton className="w-[500px] h-[20px] rounded-full" />
          </div>

          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Skeleton className="w-[500px] h-[20px] rounded-full" />
          </div>
        </div>

        <div className="grow gap-2">
          <Label htmlFor="editor">Inhalt</Label>
          <Skeleton className="w-full h-[calc(100vh-theme(spacing.72)-theme(spacing.6))] rounded-l" />
        </div>
        <Button type="submit" className="w-full mt-2">
          Textbaustein speichern
        </Button>
      </div>
    </Card>
  );
}
