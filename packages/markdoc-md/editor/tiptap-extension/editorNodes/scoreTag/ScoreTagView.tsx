'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/components/popover';

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

  const handleSelectNode = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos();
      if (typeof pos === 'number') {
        editor.commands.setNodeSelection(pos);
        editor.commands.focus();
      }
    },
    [editor, getPos]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos);
          editor.commands.focus();
        }
      }
    },
    [editor, getPos]
  );

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-orange ring-2 ring-solarized-orange/50'
            : 'border-solarized-orange'
        }`}
      >
        <button
          data-drag-handle
          className="cursor-pointer border-solarized-orange border-r bg-solarized-orange px-2 font-bold text-white"
          onClick={handleSelectNode}
          onKeyDown={handleKeyDown}
          type="button"
          contentEditable={false}
        >
          Score
        </button>

        <Popover>
          <PopoverTrigger
            className="cursor-pointer bg-background px-2 text-foreground"
            data-type="markdoc-score"
            data-formula={node.attrs.formula}
            data-unit={node.attrs.unit}
          >
            <span className="font-mono">
              {node.attrs.formula || (
                <span className="text-muted-foreground italic">formula</span>
              )}
              {node.attrs.unit && ` ${node.attrs.unit}`}
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="formula" className="text-right">
                  Formula
                </Label>
                <Input
                  id="formula"
                  value={node.attrs.formula || ''}
                  onChange={(e) =>
                    updateAttributes({
                      formula: e.target.value,
                    })
                  }
                  className="col-span-3 font-mono"
                  placeholder="e.g., x + y * 2"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="unit" className="text-right">
                  Unit
                </Label>
                <Input
                  id="unit"
                  value={node.attrs.unit || ''}
                  onChange={(e) =>
                    updateAttributes({
                      unit: e.target.value,
                    })
                  }
                  className="col-span-3"
                  placeholder="e.g., kg, mm, °C"
                />
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

export default ScoreTagView;
