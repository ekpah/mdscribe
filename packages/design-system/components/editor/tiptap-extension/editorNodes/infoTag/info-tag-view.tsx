'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Info, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';

export function InfoTagView({
  node,
  selected,
  editor,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const handleRemoveInfo = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const handleSelectTag = useCallback(() => {
    const pos = getPos?.();
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  }, [editor, getPos]);

  return (
    // Use span for inline behavior, NodeViewWrapper handles selection styling
    // Changed align-middle to align-baseline for better text alignment
    <NodeViewWrapper
      as="span"
      className="inline-block align-baseline mx-1"
      contentEditable={false}
    >
      <span
        className={`group inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs shadow-xs transition-all ${
          selected
            ? 'border-solarized-blue ring-2 ring-solarized-blue/40'
            : 'border-solarized-blue/60 hover:border-solarized-blue'
        }`}
      >
        <Popover>
          <PopoverTrigger
            className="inline-flex cursor-pointer items-center gap-1.5 px-1 py-0.5"
            data-primary={node.attrs.primary}
            data-type="markdoc-info"
            contentEditable={false}
            onMouseDown={handleSelectTag}
          >
            {/* Info Label */}
            <span
              data-drag-handle
              className="inline-flex items-center gap-1 rounded bg-solarized-blue/15 px-1.5 py-0.5 font-semibold text-solarized-blue"
            >
              <Info className="h-3 w-3" />
              Info
            </span>

            {/* Content Part */}
            <span className="max-w-[22ch] truncate font-mono text-foreground/80">
              {node.attrs.primary || (
                <span className="text-muted-foreground italic">leer</span>
              )}
            </span>
          </PopoverTrigger>

          {/* Modern popover content matching SwitchTagView */}
          <PopoverContent
            collisionPadding={12}
            className="w-[min(320px,94vw)] max-h-[min(70vh,var(--radix-popover-content-available-height))] overflow-hidden p-0"
          >
            <div className="flex max-h-[min(70vh,var(--radix-popover-content-available-height))] flex-col">
              {/* Compact header */}
              <div className="shrink-0 border-b bg-solarized-blue/5 px-3 py-2">
                <h3 className="flex items-center font-medium text-sm text-solarized-blue">
                  <Info className="mr-1.5 h-3 w-3" />
                  Info-Konfiguration
                </h3>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-3 p-3">
                  {/* Info Variable Input */}
                  <div className="space-y-1.5">
                    <Label className="font-medium text-xs" htmlFor="primary">
                      Variablenname
                    </Label>
                    <Input
                      autoFocus
                      className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
                      id="primary"
                      onChange={(e) =>
                        updateAttributes({
                          primary: e.target.value,
                        })
                      }
                      placeholder="z.B. patientenname, alter"
                      value={node.attrs.primary || ''}
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          aria-label="Remove info tag"
          className="h-6 w-6 rounded-sm text-solarized-blue/70 hover:bg-solarized-blue/10 hover:text-solarized-blue"
          contentEditable={false}
          onClick={handleRemoveInfo}
          size="icon"
          variant="ghost"
        >
          <X className="h-3 w-3" />
        </Button>
      </span>
    </NodeViewWrapper>
  );
}
