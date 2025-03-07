'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React from 'react';

interface Step {
  id: string;
  title: string;
  content?: string;
}

interface ThinkingStepsProps {
  steps: Step[];
  currentStep: string;
  isComplete: boolean;
}

export function ThinkingSteps({
  steps,
  currentStep,
  isComplete,
}: ThinkingStepsProps) {
  const [isExpanded, setIsExpanded] = React.useState(!isComplete);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="rounded-lg bg-muted transition-colors hover:bg-muted/80">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-5">
            {!isComplete && currentStep && (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            )}
          </div>
          <span className="font-medium">Analyse</span>
          <span className="text-muted-foreground">{steps.length} Schritte</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="relative space-y-0">
                {/* Vertical line that connects all steps */}
                <div
                  className="absolute top-[24px] bottom-2 left-[7px] w-[2px] bg-foreground/50"
                  style={{ transform: 'translateX(-50%)' }}
                />

                {steps.map((step, index) => {
                  const isActive = step.id === currentStep;
                  const isCompleted =
                    isComplete ||
                    index < steps.findIndex((s) => s.id === currentStep);

                  return (
                    <div key={step.id} className="flex items-start py-2">
                      <div className="relative">
                        <div
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${isActive ? 'bg-primary' : 'bg-muted-foreground'}
                          ${isActive ? 'scale-125' : 'scale-100'} transition-all duration-200 `}
                        >
                          {isActive && (
                            <Loader2 className="absolute h-5 w-5 animate-spin text-primary" />
                          )}
                        </div>
                      </div>
                      <div className="ml-6">
                        <h4
                          className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                          {step.title}
                        </h4>
                        {step.content && (
                          <p className="mt-0.5 text-muted-foreground text-sm">
                            {step.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
