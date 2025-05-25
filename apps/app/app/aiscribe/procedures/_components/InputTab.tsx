'use client';
import { isMac } from '@/lib/isMac';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Label } from '@repo/design-system/components/ui/label';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

interface InputTabProps {
  isExpanded: boolean;
  isActive: boolean;
  isLoading: boolean;
  formData: {
    procedureNotes: string;
  };
  onToggle: () => void;
  onSubmit: (e?: FormEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function InputTab({
  isExpanded,
  isActive,
  isLoading,
  formData,
  onToggle,
  onSubmit,
  onInputChange,
}: InputTabProps) {
  const [hotkeyEnabled, setHotkeyEnabled] = useState<boolean>(false);

  useEffect(() => {
    setHotkeyEnabled(isExpanded && !isLoading);
  }, [isExpanded, isLoading]);

  useHotkeys(
    ['meta+enter', 'ctrl+enter'],
    (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onSubmit();
    },
    {
      enabled: hotkeyEnabled,
      enableOnFormTags: ['TEXTAREA'],
    }
  );
  return (
    <motion.div
      className="relative"
      animate={{
        height: isExpanded ? 'auto' : '60px',
        opacity: isExpanded ? 1 : 0.8,
      }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`size-full overflow-hidden ${isActive ? 'border-primary' : 'border-muted'}`}
      >
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between bg-card p-4"
          onClick={onToggle}
        >
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Eingabe</CardTitle>
            {!isExpanded && (
              <span className="flex items-center gap-1 rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">
                <ExclamationTriangleIcon className="h-3 w-3" />
                Keine persönlichen Patientendaten
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="p-4">
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Bitte füge hier keine Patientendaten ein und respektiere den
                  Datenschutz. Dieses Tool dient lediglich als
                  Formulierungshilfe für anonymisierte Stichpunkte!
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="procedureNotes">Prozedur-Notizen</Label>
                    <Textarea
                      id="procedureNotes"
                      name="procedureNotes"
                      placeholder="Geben Sie hier Ihre Notizen zur durchgeführten Prozedur ein..."
                      value={formData.procedureNotes}
                      onChange={onInputChange}
                      className="min-h-[150px]"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full"
                  >
                    Dokumentation generieren
                    <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-foreground">
                      <span className="text-xs" suppressHydrationWarning>
                        {isMac ? '⌘' : 'Ctrl'} + Enter
                      </span>
                    </kbd>
                  </Button>
                </form>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
