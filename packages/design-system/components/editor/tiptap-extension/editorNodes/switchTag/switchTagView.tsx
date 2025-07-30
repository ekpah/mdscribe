'use client';

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Code2, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { Separator } from '../../../../ui/separator';

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
  selected,
  deleteNode,
}: NodeViewProps) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [newCase, setNewCase] = useState({ primary: '', text: '' });

  const handleRemoveSwitch = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // Extract case nodes from content on mount and when content changes
  useEffect(() => {
    const caseNodes = node.children
      .filter((c) => c.type.name === 'caseTag')
      .map((c) => ({
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
        const absoluteChildPos = parentSwitchAbsPos + 1 + offsetInParentContent;
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
      console.error(
        'SwitchTagView: Node at position is not a caseTag, cannot remove.'
      );
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
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-green ring-2 ring-solarized-green/50'
            : 'border-solarized-green hover:border-solarized-green/80'
        }`}
      >
        <Popover>
          {/* Reverted trigger to match InfoTagView style */}
          <PopoverTrigger
            className="inline-flex cursor-pointer items-stretch overflow-hidden"
            data-type="markdoc-switch"
            data-primary={node.attrs.primary}
          >
            {/* Switch Label */}
            <span
              data-drag-handle
              className="border-solarized-green border-r bg-solarized-green px-2 font-bold text-white"
            >
              Switch
            </span>

            {/* Content Part */}
            <span className="bg-background px-2 text-foreground">
              {node.attrs.primary || (
                <span className="text-muted-foreground italic">leer</span>
              )}
            </span>
          </PopoverTrigger>

          {/* More compact popover content */}
          <PopoverContent className="w-80 p-0">
            <div className="space-y-0">
              {/* Compact header */}
              <div className="border-b bg-solarized-green/5 px-3 py-2">
                <h3 className="flex items-center font-medium text-sm text-solarized-green">
                  <Code2 className="mr-1.5 h-3 w-3" />
                  Switch-Konfiguration
                </h3>
              </div>

              <div className="space-y-3 p-3">
                {/* Switch Variable Input */}
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
                    placeholder="z.B. patiententyp, zustand"
                    className="h-8 text-sm focus:border-solarized-green focus:ring-solarized-green/50"
                    autoFocus
                  />
                </div>

                <Separator />

                {/* Cases Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-xs">
                      Fälle ({cases.length})
                    </Label>
                  </div>

                  {/* Existing Cases */}
                  <div className="space-y-1.5">
                    {cases.map((caseItem, index) => (
                      <div
                        key={index}
                        className="group rounded border bg-muted/20 p-2 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={caseItem.primary}
                              onChange={(e) =>
                                updateCase(index, 'primary', e.target.value)
                              }
                              placeholder="Fall-Wert"
                              className="h-7 text-xs"
                            />
                            <Input
                              value={caseItem.text}
                              onChange={(e) =>
                                updateCase(index, 'text', e.target.value)
                              }
                              placeholder="Inhalt"
                              className="h-7 text-xs"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCase(index)}
                            className="h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            aria-label={`Fall ${index + 1} entfernen`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Case */}
                  <div className="rounded border-2 border-muted border-dashed bg-muted/10 p-2">
                    <div className="space-y-1.5">
                      <Label className="font-medium text-muted-foreground text-xs">
                        Add New Case
                      </Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={newCase.primary}
                          onChange={(e) =>
                            setNewCase((prev) => ({
                              ...prev,
                              primary: e.target.value,
                            }))
                          }
                          placeholder="Value"
                          className="h-7 flex-1 text-xs"
                        />
                        <Input
                          value={newCase.text}
                          onChange={(e) =>
                            setNewCase((prev) => ({
                              ...prev,
                              text: e.target.value,
                            }))
                          }
                          placeholder="Content"
                          className="h-7 flex-1 text-xs"
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' &&
                              (newCase.primary || newCase.text)
                            ) {
                              e.preventDefault();
                              addCase();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={addCase}
                          disabled={!newCase.primary && !newCase.text}
                          className="h-7 w-7 bg-solarized-green p-0 hover:bg-solarized-green/90"
                          aria-label="Add new case"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {cases.length === 0 && (
                    <div className="py-4 text-center text-muted-foreground">
                      <Code2 className="mx-auto mb-1 h-6 w-6 opacity-50" />
                      <p className="text-xs">No cases defined yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemoveSwitch}
          className="h-auto self-stretch rounded-none rounded-r-md px-1 text-solarized-green/70 hover:bg-solarized-green/10 hover:text-solarized-green"
          contentEditable={false}
          aria-label="Remove switch tag"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

