'use client';

import Markdoc, { type ValidateError } from '@markdoc/markdoc';
import { EditorSidebar } from '@repo/design-system/components/editor/_components/EditorSidebar';
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
import markdocConfig from '@repo/markdoc-md/markdoc-config';
import { AlertCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';

function Submit({ hasErrors, isFormValid }: { hasErrors: boolean; isFormValid: boolean }) {
  // ✅ `pending` will be derived from the form that wraps the Submit component
  const { pending } = useFormStatus();
  const isDisabled = pending || hasErrors || !isFormValid;

  return (
    <Button className="mt-2 w-full" disabled={isDisabled} type="submit">
      {(() => {
        if (pending) {
          return 'Textbaustein speichern...';
        }
        if (!isFormValid) {
          return 'Kategorie und Name erforderlich';
        }
        if (hasErrors) {
          return 'Behebe Fehler um zu speichern';
        }
        return 'Textbaustein speichern';
      })()}
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
  const [validationErrors, setValidationErrors] = useState<ValidateError[]>([]);

  // Validation for required fields
  const isFormValid = (() => {
    const finalCategory = category === 'new' ? newCategory : category;
    return finalCategory.trim() !== '' && name.trim() !== '';
  })();
  const existingCategories = [
    'Kardiologie',
    'Gastroenterologie',
    'Diverses',
    'Onkologie',
  ];

  const handleValidationChange = useCallback(
    (errors: ValidateError[]) => {
      try {
        const ast = Markdoc.parse(content);
        const validation = Markdoc.validate(ast, markdocConfig);

        setValidationErrors(validation);

        console.log('Validation results:', {
          errors: validation,
          tiptapErrors: errors,
        });
      } catch (parseError) {
        console.error('Parse error:', parseError);
        // Create a synthetic error for parse failures
        const syntheticError = {
          type: 'error' as const,
          error: {
            message:
              parseError instanceof Error
                ? parseError.message
                : 'Unbekannter Parse-Fehler',
            location: {
              start: { line: 1 },
              end: { line: 1 },
            },
          },
        } as ValidateError;
        setValidationErrors([syntheticError]);
      }
    },
    [content]
  );

  const checkContent = () => {
    try {
      const ast = Markdoc.parse(content);
      const validation = Markdoc.validate(ast, markdocConfig);

      // Separate errors and warnings
      const checkErrors = validation.filter(
        (v: ValidateError) => v.type === 'error'
      );

      setValidationErrors(checkErrors);

      if (checkErrors.length > 0) {
        toast.error(
          `${checkErrors.length} Fehler in der Markdoc-Syntax gefunden`
        );
      } else {
        toast.success('Markdoc-Syntax ist korrekt');
      }

      console.log('Validation results:', {
        errors: checkErrors,
        ast,
      });
    } catch (parseError) {
      console.error('Parse error:', parseError);
      toast.error(
        `Parse-Fehler: ${parseError instanceof Error ? parseError.message : 'Unbekannter Fehler'}`
      );

      // Create a synthetic error for parse failures
      const syntheticError = {
        type: 'error' as const,
        error: {
          message:
            parseError instanceof Error
              ? parseError.message
              : 'Unbekannter Parse-Fehler',
          location: {
            start: { line: 1 },
            end: { line: 1 },
          },
        },
      } as ValidateError;
      setValidationErrors([syntheticError]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-(--spacing(16))-(--spacing(10))-2rem)] gap-4">
      {/* Main Editor Card */}
      <Card className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <form action={handleSubmitAction} className="grow gap-2">
        <div className="mb-4 flex grow flex-col gap-4 md:flex-row md:gap-2">
          <div className="w-full flex-1">
            <Label htmlFor="category">
              Kategorie <span className="text-solarized-red">*</span>
            </Label>
            <input
              name="category"
              type="hidden"
              value={category === 'new' ? newCategory : category}
            />
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger className={(category === 'new' ? newCategory : category).trim() === '' ? 'border-solarized-red' : ''}>
                <SelectValue placeholder="Kategorie auswählen" />
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
            {(category === 'new' ? newCategory : category).trim() === '' && (
              <p className="mt-1 text-solarized-red text-xs">Kategorie ist erforderlich</p>
            )}
          </div>
          {category === 'new' && (
            <div className="flex-1">
              <Label htmlFor="newCategory">
                Neue Kategorie <span className="text-solarized-red">*</span>
              </Label>
              <Input
                id="newCategory"
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Füge eine Kategorie hinzu"
                value={newCategory}
                className={newCategory.trim() === '' ? 'border-solarized-red' : ''}
              />
              {newCategory.trim() === '' && (
                <p className="mt-1 text-solarized-red text-xs">Neue Kategorie ist erforderlich</p>
              )}
            </div>
          )}
          <div className="flex-1">
            <Label htmlFor="name">
              Name <span className="text-solarized-red">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Vorlagenname eingeben"
              value={name}
              className={name.trim() === '' ? 'border-solarized-red' : ''}
            />
            {name.trim() === '' && (
              <p className="mt-1 text-solarized-red text-xs">Name ist erforderlich</p>
            )}
          </div>
        </div>

        <div className="grow gap-2">
          <div className="mb-3 flex items-center justify-between">
            <Label htmlFor="editor">Inhalt</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={showSource}
                id="source-toggle"
                onCheckedChange={setShowSource}
              />
              <Label htmlFor="source-toggle">Quelltext anzeigen</Label>
            </div>
          </div>

          <div className="h-[calc(100vh-(--spacing(72))-(--spacing(16)))] w-full rounded-md border border-input focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2">
            {showSource ? (
              <PlainEditor note={content} setContent={setContent} />
            ) : (
              <TipTap
                note={content}
                onValidationChange={handleValidationChange}
                setContent={setContent}
              />
            )}
          </div>

          {/* Error Display Panel */}
          {validationErrors.length > 0 && (
            <div className="mt-2 space-y-2">
              {validationErrors.length > 0 && (
                <div className="rounded-md border border-solarized-red bg-solarized-red/10 p-3">
                  <div className="flex items-center space-x-2 font-medium text-sm text-solarized-red">
                    <AlertCircle className="h-4 w-4" />
                    <span>Fehler ({validationErrors.length})</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-solarized-red/80">
                    {validationErrors.map((error, index) => (
                      <li
                        className="flex items-start space-x-2"
                        key={`error-${error.error?.message || 'unknown'}-${index}`}
                      >
                        <span className="text-solarized-red">•</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {error.error?.location && (
                              <span className="rounded bg-solarized-red/20 px-2 py-1 font-mono text-solarized-red text-xs">
                                Zeile{' '}
                                {error.error.location.start?.line || 'unknown'}
                              </span>
                            )}
                            <span className="font-medium text-solarized-red">
                              {error.type === 'error' ? 'Fehler' : 'Warnung'}
                            </span>
                          </div>
                          <p className="mt-1 text-solarized-red/90">
                            {error.error?.message ||
                              'Unbekannter Validierungsfehler'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <input name="content" type="hidden" value={content} />
        <input name="id" type="hidden" value={id} />
        <input name="authorId" type="hidden" value={author.id} />
        <div className="flex flex-row gap-2">
          <Button
            className="mt-2 w-1/10"
            onClick={checkContent}
            type="button"
            variant="secondary"
          >
            Prüfen
          </Button>
          <Submit hasErrors={validationErrors.length > 0} isFormValid={isFormValid} />
        </div>
      </form>
    </Card>

      {/* Sidebar */}
      <div className="hidden w-80 xl:block">
        <EditorSidebar />
      </div>
    </div>
  );
}
