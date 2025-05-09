'use client';

import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function CaseTagView({
  node,
  editor,
  updateAttributes,
  getPos,
  deleteNode,
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
      setPrimaryValue(node.attrs.primary || ''); // Revert
      setIsEditingPrimary(false);
    }
  };

  const handleRemoveCase = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  return (
    <NodeViewWrapper
      as="span"
      className="group mx-0.5 inline-flex items-baseline rounded border border-blue-500/50 bg-blue-50 text-xs leading-tight align-baseline"
    >
      <span
        onClick={!isEditingPrimary ? handlePrimaryDisplayClick : undefined}
        className={`flex cursor-text items-center bg-blue-500/80 px-1.5 py-0.5 text-white select-none rounded-l-sm transition-all duration-150 ease-in-out group-hover:bg-blue-500/90 ${
          isEditingPrimary ? '' : 'hover:brightness-110'
        }`}
        contentEditable={false}
      >
        {isEditingPrimary ? (
          <Input
            value={primaryValue}
            onChange={handlePrimaryInputChange}
            onBlur={handlePrimaryInputBlur}
            onKeyDown={handlePrimaryInputKeyDown}
            placeholder="case key"
            className="m-0 h-auto min-w-[50px] max-w-[120px] border-none bg-transparent p-0 text-xs text-white shadow-none ring-0 placeholder:text-gray-200 focus:ring-0"
            autoFocus
            onMouseDown={(e) => e.stopPropagation()} // Prevent Tiptap handling
            onSelectCapture={(e) => e.stopPropagation()} // Fix for selection issue
          />
        ) : (
          <span className="min-h-[1em] min-w-[1em] py-px">
            {primaryValue || 'default'} {/* Display 'default' if primary is empty */}
          </span>
        )}
      </span>

      <NodeViewContent
        as="span"
        className="case-actual-content-inline min-h-[1em] whitespace-nowrap bg-white px-1 py-0.5 text-gray-700"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={handleRemoveCase}
        className="remove-case-btn-inline h-auto self-stretch rounded-none rounded-r-sm p-0.5 px-1 text-blue-500/70 hover:bg-blue-500/10 hover:text-blue-600"
        contentEditable={false}
        aria-label="Remove case"
      >
        <X className="h-3 w-3" />
      </Button>
    </NodeViewWrapper>
  );
}

export default CaseTagView; 