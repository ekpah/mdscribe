'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
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

export function CaseTagView({
  node,
  editor,
  updateAttributes,
  getPos,
  deleteNode,
}: NodeViewProps) {
  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ primary: e.target.value });
  };

  const handleRemoveCase = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const handleContentDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // Allow text selection within the content area
    const target = e.currentTarget as HTMLElement;
    const range = document.createRange();
    const selection = window.getSelection();

    if (selection && target.firstChild) {
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  return (
    <NodeViewWrapper
      as="span"
      className="group inline-flex items-baseline rounded border border-blue-500/50 bg-blue-50/80 text-xs leading-tight"
    >
      <Popover>
        <PopoverTrigger
          className="flex cursor-pointer select-none items-center rounded-l-sm bg-blue-500/80 px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-blue-500/90"
          contentEditable={false}
        >
          <span className="min-h-[1em] min-w-[1em] py-px">
            {node.attrs.primary || 'default'}
          </span>
        </PopoverTrigger>
        <PopoverContent>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primary" className="text-right">
                Case Key
              </Label>
              <Input
                id="primary"
                value={node.attrs.primary}
                onChange={handlePrimaryChange}
                className="col-span-3"
                placeholder="Enter case key"
                autoFocus
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <NodeViewContent
        as="span"
        className="whitespace-nowrap bg-white px-1 text-gray-700"
        onDoubleClick={handleContentDoubleClick}
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={handleRemoveCase}
        className="remove-case-btn-inline h-auto self-stretch rounded-none rounded-r-sm px-1 text-blue-500/70 hover:bg-blue-500/10 hover:text-blue-600"
        contentEditable={false}
        aria-label="Remove case"
      >
        <X className="h-3 w-3" />
      </Button>
    </NodeViewWrapper>
  );
}

export default CaseTagView;
