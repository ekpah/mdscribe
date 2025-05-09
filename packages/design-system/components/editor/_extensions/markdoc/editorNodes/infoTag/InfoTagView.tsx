'use client';

import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/design-system/components/ui/popover';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';

export function InfoTagView({
  node,
  selected,
  editor,
  updateAttributes,
}: NodeViewProps) {
  return (
    // Use span for inline behavior, NodeViewWrapper handles selection styling
    // Changed align-middle to align-baseline for better text alignment
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <Popover>
        {/* Apply border and rounding to the trigger, use items-stretch */}
        <PopoverTrigger
          className="inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border border-solarized-blue text-xs"
          data-type="markdoc-info"
          data-primary={node.attrs.primary}
        >
          {/* Label Part: Remove rounding, add right border */}
          <span
            data-drag-handle // Make only the label draggable
            className={
              'border-solarized-blue border-r bg-solarized-blue px-2 font-bold text-white'
            }
          >
            Info
          </span>
          {/* Content Part: Remove rounding and border */}
          <span
            className={
              'bg-background px-2 text-foreground' // Removed border classes and rounding
            }
          >
            {node.attrs.primary || (
              <span className="text-muted-foreground italic">empty</span>
            )}
          </span>
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
    </NodeViewWrapper>
  );
}

export default InfoTagView;
