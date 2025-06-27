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

  return (
    // Use span for inline behavior, NodeViewWrapper handles selection styling
    // Changed align-middle to align-baseline for better text alignment
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-blue ring-2 ring-solarized-blue/50'
            : 'border-solarized-blue hover:border-solarized-blue/80'
        }`}
      >
        <Popover>
          <PopoverTrigger
            className="inline-flex cursor-pointer items-stretch overflow-hidden"
            data-type="markdoc-info"
            data-primary={node.attrs.primary}
          >
            {/* Info Label */}
            <span
              data-drag-handle
              className="border-solarized-blue border-r bg-solarized-blue px-2 font-bold text-white"
            >
              Info
            </span>

            {/* Content Part */}
            <span className="bg-background px-2 text-foreground">
              {node.attrs.primary || (
                <span className="text-muted-foreground italic">empty</span>
              )}
            </span>
          </PopoverTrigger>

          {/* Modern popover content matching SwitchTagView */}
          <PopoverContent className="w-80 p-0">
            <div className="space-y-0">
              {/* Compact header */}
              <div className="border-b bg-solarized-blue/5 px-3 py-2">
                <h3 className="flex items-center font-medium text-sm text-solarized-blue">
                  <Info className="mr-1.5 h-3 w-3" />
                  Info-Konfiguration
                </h3>
              </div>

              <div className="space-y-3 p-3">
                {/* Info Variable Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="primary" className="font-medium text-xs">
                    Variablenname
                  </Label>
                  <Input
                    id="primary"
                    value={node.attrs.primary || ''}
                    onChange={(e) =>
                      updateAttributes({
                        primary: e.target.value,
                      })
                    }
                    placeholder="z.B. patientenname, alter"
                    className="h-8 text-sm focus:border-solarized-blue focus:ring-solarized-blue/50"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemoveInfo}
          className="h-auto self-stretch rounded-none rounded-r-md px-1 text-solarized-blue/70 hover:bg-solarized-blue/10 hover:text-solarized-blue"
          contentEditable={false}
          aria-label="Remove info tag"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

export default InfoTagView;
