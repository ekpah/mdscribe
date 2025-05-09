'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SwitchTagView({
  node,
  editor,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const [primaryValue, setPrimaryValue] = useState(node.attrs.primary || '');

  useEffect(() => {
    setPrimaryValue(node.attrs.primary || '');
  }, [node.attrs.primary]);

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setPrimaryValue(newValue);
    updateAttributes({ primary: newValue });
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
      .focus()
      .insertContentAt(insertPos, {
        type: 'caseTag',
        attrs: { primary: '' },
        content: [
          {
            type: 'text',
            text: 'case content',
          },
        ],
      })
      .run();
  };

  return (
    <NodeViewWrapper
      as="div"
      className="markdoc-switch not-prose my-2 inline-block rounded-md border border-solarized-green text-xs align-top"
    >
      <div
        className="flex items-center justify-between bg-solarized-green p-1"
        contentEditable={false}
      >
        <div className="flex items-center">
          <span
            data-drag-handle
            className="select-none px-2 py-1 font-bold text-white"
          >
            switch
          </span>
          <Input
            value={primaryValue}
            onChange={handlePrimaryChange}
            placeholder="Switch variable"
            className="ml-2 inline-block h-6 max-w-[150px] rounded-sm border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-700 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={addCase}
          className="p-1 text-white hover:bg-opacity-75"
          aria-label="Add new case"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <NodeViewContent className="content is-editable block min-h-[20px] p-2" />
    </NodeViewWrapper>
  );
}

export default SwitchTagView;
