import parseMarkdocToInputs from '@/lib/parseMarkdocToInputs';
import renderMarkdocAsReact from '@/lib/renderMarkdocAsReact';
import {
  Card,
  CardContent,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { FieldValues } from 'react-hook-form';
import Inputs from '../../templates/[id]/_components/Inputs';

interface DispositionTabProps {
  isExpanded: boolean;
  isActive: boolean;
  isLoading: boolean;
  completion: string | undefined;
  onToggle: () => void;
  onFormChange: (data: FieldValues) => void;
}

export function DispositionTab({
  isExpanded,
  isActive,
  isLoading,
  completion,
  onToggle,
  onFormChange,
}: DispositionTabProps) {
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
          <CardTitle className="text-lg">Entlassung</CardTitle>
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
                      parseMarkdocToInputs(completion || '')
                    )}
                    onChange={onFormChange}
                  />

                  {/* Right Side - Output Sections */}
                  <div className="space-y-4">
                    {isLoading && (
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-10 w-10 animate-spin" />
                      </div>
                    )}
                    {completion && (
                      <div>{renderMarkdocAsReact(completion)}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
