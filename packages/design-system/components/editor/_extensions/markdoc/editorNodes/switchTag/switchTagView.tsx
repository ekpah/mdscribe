'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/design-system/components/ui/popover';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CaseItem {
  primary: string;
  node: ProseMirrorNode;
}

// Renamed function to SwitchTagView
export function SwitchTagView({
  node,
  selected,
  editor,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [newCaseValue, setNewCaseValue] = useState('');

  // Extract case nodes from content on mount and when content changes
  useEffect(() => {
    const caseNodes = node.children
      .filter((n: ProseMirrorNode) => n.type.name === 'caseTag')
      .map((n: ProseMirrorNode) => ({
        primary: n.attrs.primary || '',
        node: n,
      }));
    setCases(caseNodes);
  }, [node.children]);

  const addCase = () => {
    if (!newCaseValue) {
      return;
    }

    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos === null) {
      return;
    }

    // Insert a new case tag at the end of the switch content
    editor
      .chain()
      .focus()
      .insertContentAt(pos + 1, {
        type: 'caseTag',
        attrs: { primary: newCaseValue },
      })
      .run();

    setNewCaseValue('');
  };

  const removeCase = (index: number) => {
    const targetNode = cases[index]?.node;
    if (targetNode) {
      editor.chain().focus().deleteNode(targetNode.type).run();
    }
  };

  const updateCase = (index: number, value: string) => {
    const targetNode = cases[index]?.node;
    if (targetNode) {
      editor
        .chain()
        .focus()
        .updateAttributes(targetNode.type, { primary: value })
        .run();
    }
  };

  return (
    <NodeViewWrapper>
      <Popover>
        <PopoverTrigger
          className="inline-block cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-500 px-2 py-1 text-white"
          data-type="markdoc-switch"
          data-primary={node.attrs.primary}
        >
          <span data-drag-handle className="font-bold text-white text-xs">
            switch
          </span>
          {node.attrs.primary}
          {node.children.map((child, index) => (
            <span
              key={index}
              className="rounded-sm bg-white p-1 text-gray-700 text-xs"
            >
              {child.attrs.primary}
            </span>
          ))}
        </PopoverTrigger>
        <PopoverContent>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primary" className="text-right">
                Variable
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
                placeholder="Enter switch variable"
                autoFocus
              />
            </div>
            <div className="border-t pt-4">
              <Label className="mb-2 block">Cases</Label>
              {cases.map((caseItem, index) => (
                <div key={index} className="mb-2 flex items-center gap-2">
                  <Input
                    value={caseItem.primary}
                    onChange={(e) => updateCase(index, e.target.value)}
                    placeholder="Case value"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCase(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={newCaseValue}
                  onChange={(e) => setNewCaseValue(e.target.value)}
                  placeholder="New case value"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCase();
                    }
                  }}
                />
                <Button variant="ghost" size="icon" onClick={addCase}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

export default SwitchTagView;
