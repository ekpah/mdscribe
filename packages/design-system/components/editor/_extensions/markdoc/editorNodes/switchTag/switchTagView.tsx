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
  text: string;
  node: ProseMirrorNode;
}

// Renamed function to SwitchTagView
export function SwitchTagView({
  node,
  editor,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [newCase, setNewCase] = useState({ primary: '', text: '' });

  // Extract case nodes from content on mount and when content changes
  useEffect(() => {
    const caseNodes = node.children.filter((c) => c.type.name === 'caseTag').map((c) => ({
      primary: c.attrs.primary || '',
      // Ensure content and text exist before accessing
      text: c.content?.content?.[0]?.text || '',
      node: c,
    }));
    setCases(caseNodes);
  }, [node.children]);

  const findCaseNodeAndPos = (
    targetIndex: number
  ): { pos: number; node: ProseMirrorNode } | undefined => {
    const parentSwitchAbsPos = getPos(); // Position of the start of the switchTag node

    if (typeof parentSwitchAbsPos !== 'number') {
      console.error(
        "SwitchTagView.findCaseNodeAndPos: Could not get parent switch node's position."
      );
      return undefined;
    }

    const caseTagChildrenInfo: Array<{ pos: number; node: ProseMirrorNode }> =
      [];

    // Iterate over the direct children of the switchTag node (`node`).
    // The `offset` is relative to the start of the parent node's content.
    // The content of a node starts after its opening tag.
    node.forEach((childNode, offsetInParentContent) => {
      if (childNode.type.name === 'caseTag') {
        // The absolute position of the childNode in the document is:
        // position of parent switchTag + 1 (for the switchTag's opening tag) + offset of childNode within parent's content
        const absoluteChildPos =
          parentSwitchAbsPos + 1 + offsetInParentContent;
        caseTagChildrenInfo.push({
          pos: absoluteChildPos,
          node: childNode,
        });
      }
    });

    if (targetIndex >= 0 && targetIndex < caseTagChildrenInfo.length) {
      return caseTagChildrenInfo[targetIndex];
    }
    // Optionally, log if the specific case was not found.
    // console.warn(
    //   `SwitchTagView.findCaseNodeAndPos: caseTag at index ${targetIndex} not found. Total caseTags: ${caseTagChildrenInfo.length}`
    // );
    return undefined;
  };

  const addCase = () => {
    if (!newCase.primary && !newCase.text) {
      return;
    }

    const currentPos = getPos();
    if (typeof currentPos !== 'number') {
      return; // Ensure getPos returns a number
    }

    // Insert *inside* the switch tag, before the closing part
    const insertPos = currentPos + node.nodeSize - 1;
    editor.commands.insertContentAt(insertPos, {
      type: 'caseTag',
      attrs: {
        primary: newCase.primary,
      },
      content: [
        {
          type: 'text',
          text: newCase.text,
        },
      ],
    });

    setNewCase({ primary: '', text: '' });
  };


  const removeCase = (index: number) => {
    const target = findCaseNodeAndPos(index);
    if (!target) return;
    
    const { pos, node: childNode } = target;
    
    // Ensure we're deleting the correct case node by verifying its type
    const nodeAtPos = editor.state.doc.nodeAt(pos);
    if (nodeAtPos?.type.name !== 'caseTag') {
      console.error('SwitchTagView: Node at position is not a caseTag, cannot remove.');
      return;
    }
    
    // Calculate the exact range to delete
    const from = pos;
    const to = pos + childNode.nodeSize;
    
    // Execute the deletion without focusing the editor
    // The focus() call was causing the popover to close because it shifts focus away from the popover
    editor.chain().deleteRange({ from, to }).run();
    
    // Prevent default behavior that might cause focus changes
    // This helps keep the popover open after deletion
    setTimeout(() => {
      // Force update the editor view to reflect changes without changing focus
      editor.view.updateState(editor.view.state);
    }, 0);
  };

  const updateCase = (
    index: number,
    field: 'primary' | 'text',
    value: string
  ) => {
    const target = findCaseNodeAndPos(index);
    if (!target) return;
    const { pos } = target;
    const nodeAtPos = editor.state.doc.nodeAt(pos);

    // Verify it's the correct node type before proceeding
    if (nodeAtPos?.type.name !== 'caseTag') {
      console.error(
        `SwitchTagView: Node at position ${pos} is not a caseTag, cannot update.`
      );
      return;
    }

    if (field === 'primary') {
      editor
        .chain()
        .setNodeSelection(pos) // Select the caseTag node
        .updateAttributes('caseTag', { primary: value })
        .run();
    } else if (field === 'text') {
      // Calculate the range of the text content within the caseTag
      const textNode = nodeAtPos.content?.content?.[0];
      if (textNode && textNode.type.name === 'text') {
        const textStartPos = pos + 1; // Position after the opening tag of caseTag
        const textEndPos = textStartPos + textNode.nodeSize;
        editor
          .chain()
          .setTextSelection({ from: textStartPos, to: textEndPos }) // Select existing text
          .insertContent(value) // Replace selected text
          .run();
      } else {
        // Handle case where caseTag might be empty or have unexpected content
        const insertPos = pos + 1; // Position after the opening tag
        editor
          .chain()
          .setNodeSelection(pos) // Select the node first
          // Clear existing content if any (might be safer)
          // .deleteSelection() // This might delete the node itself if not careful
          .insertContentAt(insertPos, value) // Insert new text content
          .run();
        console.warn(
          `SwitchTagView: Updated text content for caseTag at pos ${pos}, but structure was unexpected.`
        );
      }
    }
  };

  return (
    // Use span for inline behavior, align-baseline for text alignment
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <Popover>
        {/* Apply border and rounding to the trigger, use items-stretch */}
        <PopoverTrigger
          className="inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border border-solarized-green text-xs" // Mimic InfoTag style, keep border green
          data-type="markdoc-switch"
          data-primary={node.attrs.primary}
        >
          {/* Tag Name Part */}
          <span
            data-drag-handle // Keep drag handle here
            className="flex items-center bg-solarized-green px-2 py-1 font-bold text-white" // Keep green background, add flex for vertical centering
          >
            switch
          </span>
          {/* Primary Value Part */}
          <span className="flex items-center bg-white px-2 py-1 text-gray-700">
            {/* Display primary value, add placeholder if empty */}
            {node.attrs.primary || '...'}
            {node.children.filter((child) => child.type.name === 'caseTag').map((child, index) => (
              <span
                key={index}
                className="mx-1 inline-block rounded-md bg-muted/50 px-1.5 py-0.5 text-muted-foreground text-xs" // Pale bubble style
              >
                {child.attrs.primary || '...'} {/* Placeholder if empty */}
              </span>
            ))}
          </span>
          {/* Omitted case values from trigger for simplicity, similar to InfoTag */}
        </PopoverTrigger>
        <PopoverContent>
          <div className="grid gap-4 py-4">
            {/* Switch Variable Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="primary" className="text-right">
                Name
              </Label>
              <Input
                id="primary"
                value={node.attrs.primary || ''} // Ensure value is not null
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
            {/* Cases Section */}
            <div className="border-t pt-4">
              <Label className="mb-2 block">Cases</Label>
              {/* Existing Cases */}
              {cases.map((caseItem, index) => (
                <div key={index} className="mb-2 grid grid-cols-5 items-center gap-2">
                  {caseItem?.primary ? (
                    <Input
                      value={caseItem.primary}
                      onChange={(e) =>
                        updateCase(index, 'primary', e.target.value)
                      }
                      placeholder="Case key"
                      className="w-full col-span-2"
                    />
                  ) : (
                    <span className="text-muted-foreground col-span-2">
                       
                    </span>
                  )}
                  <Input
                    value={caseItem.text}
                    onChange={(e) => updateCase(index, 'text', e.target.value)}
                    placeholder="Case value"
                    className="w-full col-span-2" // Adjusted to col-span-2
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCase(index)}
                    aria-label={`Remove case ${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {/* Add New Case */}
              <div className="mt-2 grid grid-cols-5 items-center gap-2">
                <Input
                  value={newCase.primary}
                  onChange={(e) =>
                    setNewCase((prev) => ({ ...prev, primary: e.target.value }))
                  }
                  placeholder="New case key"
                  className="w-full col-span-2"
                />
                <Input
                  value={newCase.text}
                  onChange={(e) =>
                    setNewCase((prev) => ({ ...prev, text: e.target.value }))
                  }
                  placeholder="New case value"
                  className="w-full col-span-2"
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      (newCase.primary || newCase.text)
                    ) {
                      // Allow enter if either field has content
                      e.preventDefault();
                      addCase();
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={addCase}
                  disabled={!newCase.primary && !newCase.text} // Disable if fields are empty
                  aria-label="Add new case"
                >
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
