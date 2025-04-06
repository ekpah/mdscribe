import parseMarkdocToInputs from '@/lib/parseMarkdocToInputs';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Card,
  CardContent,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';
import Inputs from '../../templates/[id]/_components/Inputs';
import { CopyableSection } from '../_components/CopyableSection';

interface OutputTabProps {
  isExpanded: boolean;
  isActive: boolean;
  isLoading: boolean;
  isDischargeLoading: boolean;
  completion: string | undefined;
  onSubmit: (e?: FormEvent) => void;
  outputData: {
    diagnoseblock: string;
    anamnese: string;
  };
  onToggle: () => void;
  onFormChange: (data: FieldValues) => void;
  hasAnamnese: boolean;
}

export function OutputTab({
  isExpanded,
  isActive,
  isLoading,
  isDischargeLoading,
  outputData,
  onSubmit,
  onToggle,
  onFormChange,
  hasAnamnese,
}: OutputTabProps) {
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
        className={`overflow-hidden ${isActive ? 'border-primary' : 'border-muted'}`}
      >
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between bg-card p-4"
          onClick={onToggle}
          onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        >
          <CardTitle className="text-lg">Dokumentation</CardTitle>
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
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Left Side - Input Fields and Selections */}
                  <Inputs
                    inputTags={JSON.stringify(
                      parseMarkdocToInputs(outputData.anamnese || '')
                    )}
                    onChange={onFormChange}
                  />

                  {/* Right Side - Output Sections */}
                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-4">
                      {isLoading && (
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-10 w-10 animate-spin" />
                        </div>
                      )}
                      {Object.entries(outputData).map(([section, content]) => (
                        <CopyableSection
                          key={section}
                          title={section}
                          content={content || `Kein ${section} verfügbar`}
                        />
                      ))}
                    </div>
                    <Button
                      type="submit"
                      disabled={isLoading || isDischargeLoading || !hasAnamnese}
                      className="group w-full"
                    >
                      Generiere Entlassungsbericht
                      <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-foreground">
                        <span className="text-xs">⌘</span> + Enter
                      </kbd>
                    </Button>
                  </form>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
