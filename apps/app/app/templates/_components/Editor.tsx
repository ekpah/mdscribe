'use client';

import markdocConfig from '@/markdoc/config';
import Markdoc from '@markdoc/markdoc';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/design-system/components/ui/tabs';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'react-hot-toast';
import PlainEditor from './PlainEditor';
import TipTap from './TipTap';

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
  showTipTap,
}: {
  cat: string;
  tit: string;
  note: string;
  id?: string;
  handleSubmitAction: (formData: FormData) => Promise<void>;
  author: { id: string; email: string };
  showTipTap: boolean;
}) {
  const [category, setCategory] = useState<string>(cat);
  const [name, setName] = useState(tit);
  const [content, setContent] = useState(note ? JSON.parse(note) : '');
  const [newCategory, setNewCategory] = useState('');
  const existingCategories = [
    'Kardiologie',
    'Gastroenterologie',
    'Diverses',
    'Onkologie',
  ];
  const [activeTab, setActiveTab] = useState('edit');

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
        <div className="flex grow flex-col gap-2 md:flex-row">
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
          <Label htmlFor="editor">Inhalt</Label>

          {showTipTap ? (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="grow"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
                <TabsTrigger value="tiptap">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div className="h-[calc(100vh-(--spacing(72))-(--spacing(14)))] w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <PlainEditor note={content} setContent={setContent} />
                </div>
              </TabsContent>
              <TabsContent value="tiptap">
                <div className="h-[calc(100vh-(--spacing(72))-(--spacing(14)))] w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <TipTap note={content} setContent={setContent} />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-[calc(100vh-(--spacing(72))-(--spacing(14)))] w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <PlainEditor note={content} setContent={setContent} />
            </div>
          )}
        </div>
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
