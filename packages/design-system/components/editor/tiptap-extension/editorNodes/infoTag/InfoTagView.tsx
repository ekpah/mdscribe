'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { X } from 'lucide-react';
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
    // Use span for inline behavior, NodeViewWrapper handles selection styling
    // Changed align-middle to align-baseline for better text alignment
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-blue ring-2 ring-solarized-blue/50'
            : 'border-solarized-blue'
        }`}
      >
        {/* Info Label - Click to select node */}
        <button
          data-drag-handle // Make only the label draggable
          className="cursor-pointer border-solarized-blue border-r bg-solarized-blue px-2 font-bold text-white"
          onClick={handleSelectNode}
          onKeyDown={handleKeyDown}
          type="button"
          contentEditable={false}
        >
          Info
        </button>

        {/* Content Part - Click to open popover */}
        <Popover>
          <PopoverTrigger
            className="cursor-pointer bg-background px-2 text-foreground"
            data-type="markdoc-info"
            data-primary={node.attrs.primary}
          >
            {node.attrs.primary || (
              <span className="text-muted-foreground italic">empty</span>
            )}
          </PopoverTrigger>
          <PopoverContent>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="primary" className="text-right">
                  Name
                </Label>
                <Input
                  id="primary"
                  value={node.attrs.primary}
                  onChange={(e) =>
                    updateAttributes({
                      primary: e.target.value,
                    })
                  }
                  className="col-span-3"
                  placeholder="Enter info value"
                  autoFocus
                />
              </div>
              {/* TODO: Add input for 'variable' attribute if needed */}
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
