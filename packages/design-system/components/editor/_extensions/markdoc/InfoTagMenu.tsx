'use client';

import { Button } from '@repo/design-system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/design-system/components/ui/dialog';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import type { Editor } from '@tiptap/core';
import { useEffect, useState } from 'react';

interface InfoTagMenuProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

export function InfoTagMenu({ editor, isOpen, onClose }: InfoTagMenuProps) {
  const [primary, setPrimary] = useState('');
  const [variable, setVariable] = useState('');

  // Update form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Try to get the selected node
      const { state } = editor;
      const { from } = state.selection;
      const node = state.doc.nodeAt(from);

      if (node?.type.name === 'infoTag') {
        setPrimary(node.attrs.primary || '');
        setVariable(node.attrs.variable || '');
      }
    }
  }, [isOpen, editor]);

  const handleSave = () => {
    if (!primary.trim()) {
      return;
    }

    // Update the node with new attributes
    editor
      .chain()
      .focus()
      .updateAttributes('infoTag', {
        primary: primary.trim(),
        variable: variable.trim() || null, // Use null if empty to match the schema
      })
      .run();

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Info Tag</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="primary" className="text-right">
              Field Name
            </Label>
            <Input
              id="primary"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="col-span-3"
              placeholder="Enter field name"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="variable" className="text-right">
              Variable
            </Label>
            <Input
              id="variable"
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              className="col-span-3"
              placeholder="Optional variable name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave} disabled={!primary.trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
