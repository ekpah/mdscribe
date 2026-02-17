'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import Formula from 'fparser';
import { AlertTriangle, Calculator, CheckCircle2, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import { Textarea } from '../../../../ui/textarea';

export function ScoreTagView({
  node,
  selected,
  editor,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const formulaValue = node.attrs.formula ?? '';
  const unitValue = node.attrs.unit ?? '';
  const formulaInputRef = useRef<HTMLTextAreaElement>(null);
  const datalistIdRef = useRef(
    `score-variables-${Math.random().toString(36).slice(2, 9)}`
  );
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState({ variable: '', weight: '' });

  useEffect(() => {
    if (!editor) return;

    const updateVariables = () => {
      const variables = new Set<string>();
      editor.state.doc.descendants((docNode) => {
        if (docNode.type.name === 'infoTag' && docNode.attrs.primary) {
          variables.add(docNode.attrs.primary);
        }
      });
      setAvailableVariables(Array.from(variables).sort());
    };

    updateVariables();
    editor.on('update', updateVariables);

    return () => {
      editor.off('update', updateVariables);
    };
  }, [editor]);

  const { parsedVariables, parseError } = useMemo(() => {
    if (!formulaValue.trim()) {
      return { parsedVariables: [], parseError: null as Error | null };
    }

    try {
      const formula = new Formula(formulaValue);
      return {
        parsedVariables: formula.getVariables(),
        parseError: null,
      };
    } catch (error) {
      return {
        parsedVariables: [],
        parseError: error as Error,
      };
    }
  }, [formulaValue]);

  const handleRemoveScore = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const handleSelectTag = useCallback(() => {
    const pos = getPos?.();
    if (typeof pos === 'number') {
      editor.chain().focus().setNodeSelection(pos).run();
    }
  }, [editor, getPos]);

  const insertIntoFormula = (snippet: string) => {
    const current = formulaValue;
    const input = formulaInputRef.current;

    if (!input) {
      updateAttributes({ formula: `${current}${snippet}` });
      return;
    }

    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    const nextValue = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
    updateAttributes({ formula: nextValue });

    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + snippet.length;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const insertVariable = (variable: string) => {
    const normalized = variable.trim().replace(/^\[|\]$/g, '');
    if (!normalized) return;
    insertIntoFormula(`[${normalized}]`);
  };

  const insertOperator = (operator: string) => {
    const snippet = formulaValue.trim() ? ` ${operator} ` : operator;
    insertIntoFormula(snippet);
  };

  const handleAddTerm = () => {
    const variable = newTerm.variable.trim().replace(/^\[|\]$/g, '');
    if (!variable) return;

    const weight = newTerm.weight.trim();
    const normalizedWeight = weight === '' || weight === '1' ? '' : weight;
    const term = normalizedWeight
      ? `${normalizedWeight} * [${variable}]`
      : `[${variable}]`;

    const current = formulaValue.trim();
    const nextFormula = current ? `${current} + ${term}` : term;
    updateAttributes({ formula: nextFormula });
    setNewTerm({ variable: '', weight: '' });

    requestAnimationFrame(() => {
      formulaInputRef.current?.focus();
    });
  };

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block align-baseline mx-1"
      contentEditable={false}
    >
      <span
        className={`group inline-flex items-center gap-1 rounded-md border px-1 py-0.5 text-xs shadow-xs transition-all ${
          selected
            ? 'border-solarized-orange ring-2 ring-solarized-orange/40'
            : 'border-solarized-orange/60 hover:border-solarized-orange'
        }`}
      >
        <Popover>
          <PopoverTrigger
            className="inline-flex cursor-pointer items-center gap-1.5 px-1 py-0.5"
            data-type="markdoc-score"
            data-formula={node.attrs.formula}
            data-unit={node.attrs.unit}
            contentEditable={false}
            onMouseDown={handleSelectTag}
          >
            {/* Score Label */}
            <span
              data-drag-handle
              className="inline-flex items-center gap-1 rounded bg-solarized-orange/15 px-1.5 py-0.5 font-semibold text-solarized-orange"
            >
              <Calculator className="h-3 w-3" />
              Score
            </span>

            {/* Content Part */}
            <span className="max-w-[22ch] truncate font-mono text-foreground/80">
              {formulaValue || (
                <span className="text-muted-foreground italic">Formel</span>
              )}
            </span>
            {unitValue && (
              <span className="text-muted-foreground">· {unitValue}</span>
            )}
          </PopoverTrigger>

          {/* Score configuration popover */}
          <PopoverContent
            collisionPadding={12}
            className="w-[min(420px,96vw)] max-h-[min(80vh,var(--radix-popover-content-available-height))] overflow-hidden p-0"
          >
            <div className="flex max-h-[min(80vh,var(--radix-popover-content-available-height))] flex-col">
              {/* Compact header */}
              <div className="shrink-0 border-b bg-solarized-orange/5 px-3 py-2">
                <h3 className="flex items-center font-medium text-sm text-solarized-orange">
                  <Calculator className="mr-1.5 h-3 w-3" />
                  Score-Konfiguration
                </h3>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 p-3">
                  {/* Formula Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="formula" className="font-medium text-xs">
                      Formel
                    </Label>
                    <Textarea
                      id="formula"
                      ref={formulaInputRef}
                      value={formulaValue}
                      onChange={(e) =>
                        updateAttributes({
                          formula: e.target.value,
                        })
                      }
                      placeholder="z.B. [age] * 2 + [crp] * 3"
                      className="min-h-[72px] text-sm font-mono focus:border-solarized-orange focus:ring-solarized-orange/50"
                      autoFocus
                    />
                    <p className="text-muted-foreground text-xs">
                      Variablen in eckigen Klammern verwenden, z.B.{" "}
                      <span className="font-mono">[age]</span>.
                    </p>

                    {parseError ? (
                      <div className="flex items-start gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-destructive text-xs">
                        <AlertTriangle className="mt-0.5 h-3 w-3" />
                        <span>Formel ist ungültig. Prüfe Klammern und Operatoren.</span>
                      </div>
                    ) : formulaValue.trim() ? (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Formel sieht gültig aus.</span>
                      </div>
                    ) : null}

                    {parsedVariables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parsedVariables.map((variable) => (
                          <span
                            key={variable}
                            className="rounded-full border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-0.5 font-mono text-[11px] text-solarized-orange"
                          >
                            [{variable}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Insert */}
                  <div className="space-y-2">
                    <Label className="font-medium text-xs">Schnell einfügen</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableVariables.length > 0 ? (
                        availableVariables.map((variable) => (
                          <button
                            key={variable}
                            type="button"
                            onClick={() => insertVariable(variable)}
                            className="inline-flex items-center rounded-full border border-solarized-orange/20 bg-solarized-orange/10 px-2 py-0.5 font-mono text-[11px] text-solarized-orange transition hover:border-solarized-orange/50 hover:bg-solarized-orange/15"
                          >
                            [{variable}]
                          </button>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Noch keine Info-Variablen im Dokument.
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['+', '-', '*', '/', '(', ')'].map((operator) => (
                        <button
                          key={operator}
                          type="button"
                          onClick={() => insertOperator(operator)}
                          className="inline-flex items-center rounded-md border border-solarized-orange/20 bg-background px-2 py-0.5 font-mono text-[11px] text-foreground transition hover:border-solarized-orange/40 hover:bg-solarized-orange/5"
                        >
                          {operator}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add term builder */}
                  <div className="space-y-2">
                    <Label className="font-medium text-xs">
                      Komponente hinzufügen
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={newTerm.variable}
                        onChange={(e) =>
                          setNewTerm((prev) => ({
                            ...prev,
                            variable: e.target.value,
                          }))
                        }
                        list={datalistIdRef.current}
                        placeholder="Variable"
                        className="h-8 text-xs font-mono focus:border-solarized-orange focus:ring-solarized-orange/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTerm.variable.trim()) {
                            e.preventDefault();
                            handleAddTerm();
                          }
                        }}
                      />
                      <Input
                        value={newTerm.weight}
                        onChange={(e) =>
                          setNewTerm((prev) => ({
                            ...prev,
                            weight: e.target.value,
                          }))
                        }
                        placeholder="Gewicht (z.B. 2)"
                        inputMode="decimal"
                        className="h-8 text-xs focus:border-solarized-orange focus:ring-solarized-orange/50"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTerm.variable.trim()) {
                            e.preventDefault();
                            handleAddTerm();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAddTerm}
                        disabled={!newTerm.variable.trim()}
                        className="h-8 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Hinzufügen
                      </Button>
                    </div>
                    <datalist id={datalistIdRef.current}>
                      {availableVariables.map((variable) => (
                        <option key={variable} value={variable} />
                      ))}
                    </datalist>
                  </div>

                  {/* Unit Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="unit" className="font-medium text-xs">
                      Einheit (optional)
                    </Label>
                    <Input
                      id="unit"
                      value={unitValue}
                      onChange={(e) =>
                        updateAttributes({
                          unit: e.target.value,
                        })
                      }
                      placeholder="z.B. kg, mm, °C, Punkte"
                      className="h-8 text-sm focus:border-solarized-orange focus:ring-solarized-orange/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRemoveScore}
          className="h-6 w-6 rounded-sm text-solarized-orange/70 hover:bg-solarized-orange/10 hover:text-solarized-orange"
          contentEditable={false}
          aria-label="Remove score tag"
        >
          <X className="h-3 w-3" />
        </Button>
      </span>
    </NodeViewWrapper>
  );
}
