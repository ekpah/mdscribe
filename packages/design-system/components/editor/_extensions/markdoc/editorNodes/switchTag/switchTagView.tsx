'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function SwitchTagView({
  node,
  editor,
  updateAttributes,
  getPos,
}: NodeViewProps) {
  const [primaryValue, setPrimaryValue] = useState(node.attrs.primary || '');
  const [isEditingPrimary, setIsEditingPrimary] = useState(false);

  useEffect(() => {
    if (!isEditingPrimary) {
      setPrimaryValue(node.attrs.primary || '');
    }
  }, [node.attrs.primary, isEditingPrimary]);

  const handlePrimaryDisplayClick = useCallback(() => {
    setIsEditingPrimary(true);
  }, []);

  const handlePrimaryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrimaryValue(e.target.value);
  };

  const savePrimary = useCallback(() => {
    updateAttributes({ primary: primaryValue });
    setIsEditingPrimary(false);
  }, [primaryValue, updateAttributes]);

  const handlePrimaryInputBlur = () => {
    savePrimary();
  };

  const handlePrimaryInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      savePrimary();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setPrimaryValue(node.attrs.primary || ''); // Revert to original
      setIsEditingPrimary(false);
    }
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
      // .focus() // Focusing might not be desired for inline adds
      .insertContentAt(insertPos, {
        type: 'caseTag',
        attrs: { primary: '' },
        content: [{ type: 'text', text: 'new case' }],
      })
      .run();
  };

  return (
    <NodeViewWrapper
      as="span"
      className="markdoc-switch-inline group inline-flex items-baseline rounded border border-solarized-green/60 text-xs leading-tight align-baseline"
    >
      <span
        data-drag-handle
        onClick={!isEditingPrimary ? handlePrimaryDisplayClick : undefined}
        className={`flex cursor-text items-center bg-solarized-green px-1.5 text-white select-none rounded-l-sm transition-all duration-150 ease-in-out group-hover:bg-solarized-green/90 ${
          isEditingPrimary ? '' : 'hover:brightness-110'
        }`}
        contentEditable={false} // Important for Tiptap
      >
        {isEditingPrimary ? (
          <Input
            value={primaryValue}
            onChange={handlePrimaryInputChange}
            onBlur={handlePrimaryInputBlur}
            onKeyDown={handlePrimaryInputKeyDown}
            placeholder="name"
            className="border-none bg-transparent p-0 text-xs text-white shadow-none ring-0 placeholder:text-gray-300 focus:ring-0"
            autoFocus
            // Prevent Tiptap from handling events for this input
            onMouseDown={(e) => e.stopPropagation()}
            onSelectCapture={(e) => e.stopPropagation()} // Fix for selection issue
          />
        ) : (
          <span className=" min-w-[1em] py-px">
            {primaryValue || '...'}
          </span>
        )}
      </span>

      <NodeViewContent
        as="span"
        className="cases-content-inline min-h-[1em] whitespace-nowrap px-1 "
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={addCase}
        className="add-case-btn-inline h-auto self-stretch rounded-none rounded-r-sm p-0.5 px-1 text-solarized-green/80 hover:bg-solarized-green/10 hover:text-solarized-green"
        contentEditable={false} // Important for Tiptap
        aria-label="Add new case"
      >
        <Plus className="h-3 w-3" />
      </Button>
    </NodeViewWrapper>
  );
}

export default SwitchTagView;
