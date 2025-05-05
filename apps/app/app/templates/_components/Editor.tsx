'use client';

import markdocConfig from '@/markdoc/config';
import Markdoc from '@markdoc/markdoc';
import PlainEditor from '@repo/design-system/components/editor/PlainEditor';
import TipTap from '@repo/design-system/components/editor/TipTap';
import { Button } from '@repo/design-system/components/ui/button';
import { Card } from '@repo/design-system/components/ui/card';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import { Switch } from '@repo/design-system/components/ui/switch';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'react-hot-toast';

function Submit() {
  // ✅ `pending` will be derived from the form that wraps the Submit component
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" className="mt-2 w-full">
      {pending ? 'Textbaustein speichern...' : 'Textbaustein speichern'}
    </Button>
  );
}

export default function Editor({
  cat,
  tit,
  note,
  id,
  handleSubmitAction,
  author,
}: {
  cat: string;
  tit: string;
  note: string;
  id?: string;
  handleSubmitAction: (formData: FormData) => Promise<void>;
  author: { id: string; email: string };
}) {
  const [category, setCategory] = useState<string>(cat);
  const [name, setName] = useState(tit);
  const [content, setContent] = useState(note ? JSON.parse(note) : '');
  const [newCategory, setNewCategory] = useState('');
  const [showSource, setShowSource] = useState(false);
  const existingCategories = [
    'Kardiologie',
    'Gastroenterologie',
    'Diverses',
    'Onkologie',
  ];

  const checkContent = () => {
    const result = Markdoc.validate(Markdoc.parse(content), markdocConfig);
    if (result.length > 0) {
      toast.error('Fehler in der Markdown-Syntax');
    } else {
      toast.success('Markdown-Syntax ist korrekt');
    }
    console.log(result);
  };

  return (
    <Card className="flex h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] flex-col gap-4 overflow-y-auto p-4">
      <form action={handleSubmitAction} className="grow gap-2">
        <div className="mb-4 flex grow flex-col gap-4 md:flex-row md:gap-2">
          <div className="w-full flex-1">
            <Label htmlFor="category">Kategorie</Label>
            <input
              type="hidden"
              name="category"
              value={category === 'new' ? newCategory : category}
            />
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="new">Neue Kategorie hinzufügen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {category === 'new' && (
            <div className="flex-1">
              <Label htmlFor="newCategory">Neue Kategorie</Label>
              <Input
                id="newCategory"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Füge eine Kategorie hinzu"
              />
            </div>
          )}
          <div className="flex-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
            />
          </div>
        </div>

        <div className="grow gap-2">
          <div className="mb-3 flex items-center justify-between">
            <Label htmlFor="editor">Inhalt</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="source-toggle"
                checked={showSource}
                onCheckedChange={setShowSource}
              />
              <Label htmlFor="source-toggle">Show Source</Label>
            </div>
          </div>

          <div className="h-[calc(100vh-(--spacing(72))-(--spacing(16)))] w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
            {showSource ? (
              <PlainEditor note={content} setContent={setContent} />
            ) : (
              <TipTap note={content} setContent={setContent} />
            )}
          </div>
        </div>
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="authorId" value={author.id} />
        <div className="flex flex-row gap-2">
          <Button
            variant="secondary"
            onClick={checkContent}
            type="button"
            className="mt-2 w-1/10"
          >
            Prüfen
          </Button>
          <Submit />
        </div>
      </form>
    </Card>
  );
}
