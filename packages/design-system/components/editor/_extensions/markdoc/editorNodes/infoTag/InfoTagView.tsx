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
    <NodeViewWrapper as="span">
      <Popover>
        <PopoverTrigger
          className="inline-block cursor-pointer rounded-md bg-blue-500 px-2 text-white"
          data-type="markdoc-info"
          data-primary={node.attrs.primary}
        >
          <span data-drag-handle className="mr-2 font-bold text-white text-xs">
            Info
          </span>
          {node.attrs.primary}
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
                placeholder="Enter field name"
                autoFocus
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

export default InfoTagView;
