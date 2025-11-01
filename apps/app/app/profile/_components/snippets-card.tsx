'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/design-system/components/ui/dialog';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { orpcClient } from '@/lib/orpc';

interface TextSnippet {
  id: string;
  key: string;
  snippet: string;
  createdAt: Date;
  updatedAt: Date;
}

export function SnippetsCard() {
  const [snippets, setSnippets] = useState<TextSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<TextSnippet | null>(
    null
  );
  const [formData, setFormData] = useState({ key: '', snippet: '' });

  // Load snippets
  const loadSnippets = async () => {
    try {
      setIsLoading(true);
      const data = await orpcClient.user.snippets.list();
      setSnippets(data);
    } catch (error) {
      console.error('Error loading snippets:', error);
      toast.error('Fehler beim Laden der Snippets');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  const handleOpenDialog = (snippet?: TextSnippet) => {
    if (snippet) {
      setEditingSnippet(snippet);
      setFormData({ key: snippet.key, snippet: snippet.snippet });
    } else {
      setEditingSnippet(null);
      setFormData({ key: '', snippet: '' });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSnippet(null);
    setFormData({ key: '', snippet: '' });
  };

  const handleSave = async () => {
    if (!formData.key.trim() || !formData.snippet.trim()) {
      toast.error('Bitte f?llen Sie alle Felder aus');
      return;
    }

    try {
      if (editingSnippet) {
        await orpcClient.user.snippets.update({
          id: editingSnippet.id,
          key: formData.key,
          snippet: formData.snippet,
        });
        toast.success('Snippet aktualisiert');
      } else {
        await orpcClient.user.snippets.create({
          key: formData.key,
          snippet: formData.snippet,
        });
        toast.success('Snippet erstellt');
      }
      await loadSnippets();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving snippet:', error);
      toast.error(
        editingSnippet
          ? 'Fehler beim Aktualisieren des Snippets'
          : 'Fehler beim Erstellen des Snippets'
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('M?chten Sie dieses Snippet wirklich l?schen?')) {
      return;
    }

    try {
      await orpcClient.user.snippets.delete({ id });
      toast.success('Snippet gel?scht');
      await loadSnippets();
    } catch (error) {
      console.error('Error deleting snippet:', error);
      toast.error('Fehler beim L?schen des Snippets');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Text Snippets</CardTitle>
            <CardDescription>
              Verwalten Sie Ihre pers?nlichen Text-Schnipsel f?r schnellen
              Zugriff mit <kbd className="rounded bg-muted px-1 text-xs">Shift+F2</kbd>
            </CardDescription>
          </div>
          <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} size="sm" type="button">
                <Plus className="mr-2 h-4 w-4" />
                Hinzuf?gen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSnippet ? 'Snippet bearbeiten' : 'Neues Snippet'}
                </DialogTitle>
                <DialogDescription>
                  Erstellen Sie ein K?rzel, das Sie sp?ter mit Shift+F2 erweitern
                  k?nnen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key">K?rzel</Label>
                  <Input
                    id="key"
                    maxLength={50}
                    onChange={(e) =>
                      setFormData({ ...formData, key: e.target.value })
                    }
                    placeholder="z.B. ty"
                    value={formData.key}
                  />
                  <p className="text-muted-foreground text-xs">
                    Das K?rzel, das Sie eingeben, um das Snippet zu verwenden
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snippet">Text</Label>
                  <Textarea
                    className="min-h-[150px]"
                    id="snippet"
                    maxLength={5000}
                    onChange={(e) =>
                      setFormData({ ...formData, snippet: e.target.value })
                    }
                    placeholder="z.B. Vielen Dank f?r Ihre Zeit"
                    value={formData.snippet}
                  />
                  <p className="text-muted-foreground text-xs">
                    Der Text, der eingef?gt wird, wenn Sie das K?rzel erweitern
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDialog} type="button" variant="outline">
                  Abbrechen
                </Button>
                <Button onClick={handleSave} type="button">
                  {editingSnippet ? 'Aktualisieren' : 'Erstellen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Lade Snippets...
          </div>
        ) : snippets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Keine Snippets vorhanden</p>
            <p className="mt-2 text-sm">
              Erstellen Sie Ihr erstes Snippet, um loszulegen
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {snippets.map((snippet) => (
              <div
                className="flex items-start justify-between rounded-lg border p-3"
                key={snippet.id}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                      {snippet.key}
                    </code>
                  </div>
                  <p className="mt-2 text-muted-foreground text-sm line-clamp-2">
                    {snippet.snippet}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleOpenDialog(snippet)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(snippet.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4 text-solarized-red" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
