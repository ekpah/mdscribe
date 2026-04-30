'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Info, X } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/design-system/components/ui/popover';

export const InfoTagView = ({
  node,
  selected,
  editor,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) => {
  const handleRemoveInfo = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

	  const handleSelectTag = useCallback(() => {
	    const pos = getPos?.();
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
	  }, [editor, getPos]);

	  const handlePrimaryChange = useCallback(
	    (event: ChangeEvent<HTMLInputElement>) => {
	      updateAttributes({
	        primary: event.target.value,
	      });
	    },
	    [updateAttributes],
	  );

  return (
    // Use span for inline behavior, NodeViewWrapper handles selection styling
    // Changed align-middle to align-baseline for better text alignment
    <NodeViewWrapper
      as="span"
      className="mx-0.5 inline-block align-[-0.125em] leading-none"
      contentEditable={false}
    >
      <span
        className={`group inline-flex items-center gap-0.5 rounded-sm border px-1 py-0 text-[11px] leading-none shadow-xs transition-all ${
          selected
            ? 'border-solarized-blue ring-2 ring-solarized-blue/40'
            : 'border-solarized-blue/60 hover:border-solarized-blue'
        }`}
      >
        <Popover>
          <PopoverTrigger
            className="inline-flex h-[18px] cursor-pointer items-center gap-1 px-0.5 py-0 leading-none"
            data-primary={node.attrs.primary}
            data-type="markdoc-info"
            contentEditable={false}
            onMouseDown={handleSelectTag}
          >
            {/* Info Label */}
            <span
              data-drag-handle
              className="inline-flex h-[16px] items-center gap-0.5 rounded-xs bg-solarized-blue/15 px-1 py-0 font-semibold text-solarized-blue leading-none"
            >
              <Info className="h-2.5 w-2.5" />
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
	                      onChange={handlePrimaryChange}
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
          className="h-4 w-4 rounded-xs text-solarized-blue/70 hover:bg-solarized-blue/10 hover:text-solarized-blue"
          contentEditable={false}
          onClick={handleRemoveInfo}
          size="icon"
          variant="ghost"
        >
          <X className="h-2.5 w-2.5" />
        </Button>
      </span>
	    </NodeViewWrapper>
	  );
};
