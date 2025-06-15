'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/design-system/components/ui/popover';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Plus } from 'lucide-react';

export function SwitchTagView({
  node,
  editor,
  updateAttributes,
  getPos,
  selected,
}: NodeViewProps) {
  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ primary: e.target.value });
  };

  const addCase = () => {
    const parentSwitchAbsPos = getPos();
    if (typeof parentSwitchAbsPos !== 'number') {
      console.error(
        "SwitchTagView.addCase: Could not get parent switch node's position."
      );
      return;
    }
    const insertPos = parentSwitchAbsPos + 1 + node.content.size;
    editor
      .chain()
      .insertContentAt(insertPos, {
        type: 'caseTag',
        attrs: { primary: '' },
        content: [{ type: 'text', text: 'new case' }],
      })
      .run();
  };

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer select-none items-center overflow-hidden rounded border text-xs transition-all ${
          selected
            ? 'border-solarized-blue ring-2 ring-solarized-blue/50'
            : 'border-solarized-green/60'
        }`}
        data-drag-handle
      >
        <Popover>
          <PopoverTrigger
            className="flex cursor-pointer select-none items-center rounded-l-sm bg-solarized-green px-1.5 text-white transition-all duration-150 ease-in-out hover:brightness-110 group-hover:bg-solarized-green/90"
            contentEditable={false}
          >
            <span className="min-w-[1em] py-px">
              {node.attrs.primary || '...'}
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
                  value={node.attrs.primary || ''}
                  onChange={handlePrimaryChange}
                  className="col-span-3"
                  placeholder="Enter switch value"
                  autoFocus
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <NodeViewContent
          as="span"
          className="cases-content-inline min-h-[1em] whitespace-nowrap px-1 "
        />

        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={addCase}
          className="add-case-btn-inline h-auto self-stretch rounded-none rounded-r-sm px-1 text-solarized-green/80 hover:bg-solarized-green/10 hover:text-solarized-green"
          contentEditable={false}
          aria-label="Add new case"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

export default SwitchTagView;
