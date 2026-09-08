"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import type { Node } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import { useEffect, useId, useRef } from "react";

import { updateMarkdocTagAttributes } from "./use-selected-markdoc-tag";

/** Shared variable identity, in the same order for every value-producing tag. */
export const CommonTagFields = ({
	editor,
	node,
	pos,
	selectPrimary = false,
}: {
	editor: Editor;
	node: Node;
	pos: number;
	selectPrimary?: boolean;
}) => {
	const id = useId();
	const primaryRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (selectPrimary) {
			primaryRef.current?.focus();
			primaryRef.current?.select();
		}
	}, [selectPrimary]);
	return (
		<div className="space-y-3">
			{(
				[
					["primary", "Variablenname", "z.B. Herzfrequenz"],
					["description", "Beschreibung (optional)", "Hinweis für das Ausfüllen"],
					["source", "Quelle (optional)", "z.B. fhir://Observation..."],
					["unit", "Einheit (optional)", "z.B. kg, mmHg"],
				] as const
			).map(([attribute, label, placeholder]) => (
				<div className="space-y-1.5" key={attribute}>
					<Label className="font-medium text-xs" htmlFor={`${id}-${attribute}`}>
						{label}
					</Label>
					<Input
						className="h-8 text-sm"
						id={`${id}-${attribute}`}
						ref={attribute === "primary" ? primaryRef : undefined}
						placeholder={placeholder}
						value={node.attrs[attribute] || ""}
						onChange={(event) =>
							updateMarkdocTagAttributes(editor, pos, { [attribute]: event.target.value || null })
						}
					/>
				</div>
			))}
		</div>
	);
};
