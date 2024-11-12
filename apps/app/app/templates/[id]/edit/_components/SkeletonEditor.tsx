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
    <Card className="flex h-[calc(100vh-theme(spacing.16)-theme(spacing.10)-2rem)] w-full flex-col gap-4 overflow-y-auto p-4">
      <div className="grow gap-2">
        <div className="flex grow flex-col gap-2 md:flex-row">
          <div className="w-full flex-1">
            <Label htmlFor="category">Kategorie</Label>
            <Skeleton className="h-[20px] w-[500px] rounded-full" />
          </div>

          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Skeleton className="h-[20px] w-[500px] rounded-full" />
          </div>
        </div>

        <div className="grow gap-2">
          <Label htmlFor="editor">Inhalt</Label>
          <Skeleton className="h-[calc(100vh-theme(spacing.72)-theme(spacing.6))] w-full rounded-l" />
        </div>
        <Button type="submit" className="mt-2 w-full">
          Textbaustein speichern
        </Button>
      </div>
    </Card>
  );
}
