'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { Edit2, Plus, X } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from '../../../../ui/components/button';
import { Input } from '../../../../ui/components/input';
import { Label } from '../../../../ui/components/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/components/popover';
import { Separator } from '../../../../ui/components/separator';

export function SwitchTagView({
  node,
  editor,
  updateAttributes,
  getPos,
  selected,
  deleteNode,
}: NodeViewProps) {
  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateAttributes({ primary: e.target.value });
  };

  const handleRemoveSwitch = useCallback(() => {
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

  // Parse case tags from node content
  const caseTags = useMemo(() => {
    const cases: Array<{ primary: string; position: number; content: string }> =
      [];

    node.content.forEach((child, index) => {
      if (child.type.name === 'caseTag') {
        const primary = child.attrs?.primary || '';
        const content = child.textContent || '';
        cases.push({
          primary,
          position: index,
          content,
        });
      }
    });

    return cases;
  }, [node.content]);

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

  const editCase = (casePosition: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const parentSwitchAbsPos = getPos();
    if (typeof parentSwitchAbsPos !== 'number') {
      console.error(
        "SwitchTagView.editCase: Could not get parent switch node's position."
      );
      return;
    }

    // Find the case node by traversing the document
    const targetCase = caseTags[casePosition];
    if (!targetCase) return;

    // Search for the case node in the document
    const doc = editor.state.doc;
    let foundPos = -1;

    const switchNode = editor.state.doc.nodeAt(parentSwitchAbsPos);
    if (!switchNode) {
      console.warn('Could not find switch node');
      return;
    }

    doc.descendants((node, pos) => {
      if (
        node.type.name === 'caseTag' &&
        node.attrs?.primary === targetCase.primary &&
        node.textContent === targetCase.content &&
        pos > parentSwitchAbsPos &&
        pos < parentSwitchAbsPos + switchNode.nodeSize
      ) {
        foundPos = pos;
        return false; // Stop traversal
      }
      return true;
    });

    if (foundPos >= 0) {
      // Use setTimeout to allow the popover to close naturally first
      setTimeout(() => {
        editor.commands.setNodeSelection(foundPos);
        editor.commands.focus();
      }, 100);
    } else {
      console.warn('Could not find case node to edit');
    }
  };

  const removeCase = (casePosition: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const parentSwitchAbsPos = getPos();
    if (typeof parentSwitchAbsPos !== 'number') {
      console.error(
        "SwitchTagView.removeCase: Could not get parent switch node's position."
      );
      return;
    }

    // Find the case node by traversing the document
    const targetCase = caseTags[casePosition];
    if (!targetCase) return;

    // Search for the case node in the document
    const doc = editor.state.doc;
    let foundPos = -1;
    let caseSize = 0;

    const switchNode = editor.state.doc.nodeAt(parentSwitchAbsPos);
    if (!switchNode) {
      console.warn('Could not find switch node');
      return;
    }

    doc.descendants((node, pos) => {
      if (
        node.type.name === 'caseTag' &&
        node.attrs?.primary === targetCase.primary &&
        node.textContent === targetCase.content &&
        pos > parentSwitchAbsPos &&
        pos < parentSwitchAbsPos + switchNode.nodeSize
      ) {
        foundPos = pos;
        caseSize = node.nodeSize;
        return false; // Stop traversal
      }
      return true;
    });

    if (foundPos >= 0) {
      editor
        .chain()
        .deleteRange({ from: foundPos, to: foundPos + caseSize })
        .run();
    } else {
      console.warn('Could not find case node to remove');
    }
  };

  return (
    <NodeViewWrapper as="span" className="inline-block align-baseline">
      <div
        className={`inline-flex cursor-pointer items-stretch overflow-hidden rounded-md border text-xs transition-all ${
          selected
            ? 'border-solarized-green ring-2 ring-solarized-green/50'
            : 'border-solarized-green'
        }`}
      >
        {/* Switch Label - Click to select node */}
        <button
          data-drag-handle // Make only the label draggable
          className="cursor-pointer border-solarized-green border-r bg-solarized-green px-2 font-bold text-white"
          onClick={handleSelectNode}
          onKeyDown={handleKeyDown}
          type="button"
          contentEditable={false}
        >
          Switch
        </button>

        {/* Content Part - Click to open popover */}
        <Popover>
          <PopoverTrigger
            className="cursor-pointer bg-background px-2 text-foreground"
            data-type="markdoc-switch"
            data-primary={node.attrs.primary}
          >
            {node.attrs.primary || (
              <span className="text-muted-foreground italic">empty</span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80">
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

              {caseTags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="font-medium text-sm">
                      Case Tags ({caseTags.length})
                    </Label>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {caseTags.map((caseTag, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded border p-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {caseTag.primary || (
                                <span className="text-muted-foreground italic">
                                  unnamed
                                </span>
                              )}
                            </div>
                            <div className="truncate text-muted-foreground">
                              {caseTag.content || (
                                <span className="italic">empty</span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => editCase(index, event)}
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Edit case"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => removeCase(index, event)}
                              className="h-6 w-6 text-destructive/70 hover:text-destructive"
                              title="Remove case"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCase}
                  className="border-solarized-green text-solarized-green hover:bg-solarized-green hover:text-white"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add Case
                </Button>
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

export default SwitchTagView;
