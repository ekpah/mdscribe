'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Calculator, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';

export function ScoreTagView({
  node,
  selected,
  editor,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const handleRemoveScore = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-orange ring-2 ring-solarized-orange/50'
            : 'border-solarized-orange hover:border-solarized-orange/80'
        }`}
      >
        <Popover>
          <PopoverTrigger
            className="inline-flex cursor-pointer items-stretch overflow-hidden"
            data-type="markdoc-score"
            data-formula={node.attrs.formula}
            data-unit={node.attrs.unit}
          >
            {/* Score Label */}
            <span
              data-drag-handle
              className="border-solarized-orange border-r bg-solarized-orange px-2 font-bold text-white"
            >
              Score
            </span>

            {/* Content Part */}
            <span className="bg-background px-2 text-foreground">
              <span className="font-mono">
                {node.attrs.formula || (
                  <span className="text-muted-foreground italic">formula</span>
                )}
                {node.attrs.unit && ` ${node.attrs.unit}`}
              </span>
            </span>
          </PopoverTrigger>

          {/* Modern popover content matching InfoTagView and SwitchTagView */}
          <PopoverContent className="w-80 p-0">
            <div className="space-y-0">
              {/* Compact header */}
              <div className="border-b bg-solarized-orange/5 px-3 py-2">
                <h3 className="flex items-center font-medium text-sm text-solarized-orange">
                  <Calculator className="mr-1.5 h-3 w-3" />
                  Score-Konfiguration
                </h3>
              </div>

              <div className="space-y-3 p-3">
                {/* Formula Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="formula" className="font-medium text-xs">
                    Formel
                  </Label>
                  <Input
                    id="formula"
                    value={node.attrs.formula || ''}
                    onChange={(e) =>
                      updateAttributes({
                        formula: e.target.value,
                      })
                    }
                    placeholder="z.B. x + y * 2, score1 + score2"
                    className="h-8 text-sm font-mono focus:border-solarized-orange focus:ring-solarized-orange/50"
                    autoFocus
                  />
                </div>

                {/* Unit Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="unit" className="font-medium text-xs">
                    Einheit (optional)
                  </Label>
                  <Input
                    id="unit"
                    value={node.attrs.unit || ''}
                    onChange={(e) =>
                      updateAttributes({
                        unit: e.target.value,
                      })
                    }
                    placeholder="z.B. kg, mm, °C, Punkte"
                    className="h-8 text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemoveScore}
          className="h-auto self-stretch rounded-none rounded-r-md px-1 text-solarized-orange/70 hover:bg-solarized-orange/10 hover:text-solarized-orange"
          contentEditable={false}
          aria-label="Remove score tag"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

