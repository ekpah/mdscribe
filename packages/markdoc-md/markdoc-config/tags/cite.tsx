"use client";

import { Children, isValidElement } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { readCiteCitations } from "../../citations/cite-attributes";
import type { CitationRequest } from "../../citations/resolvers/types";
import { useMarkdocInteraction } from "../../render/context/markdoc-interaction-context";

const getCitationClassName = (isHighlighted: boolean, canSelect: boolean): string =>
	[
		"rounded-sm text-inherit transition-colors",
		"hover:bg-solarized-blue/20",
		isHighlighted ? "!bg-solarized-blue/25" : "bg-transparent",
		canSelect ? "cursor-pointer" : "",
	]
		.filter(Boolean)
		.join(" ");

const hasUnsupportedCitationChild = (children: ReactNode): boolean =>
	Children.toArray(children).some((child) => {
		if (!isValidElement<{ children?: ReactNode }>(child)) {
			return false;
		}
		if (typeof child.type !== "string" || child.type === "a") {
			return true;
		}
		return hasUnsupportedCitationChild(child.props.children);
	});

export interface CiteProps {
	children: ReactNode;
	/** Every `{ source, quote }` excerpt supporting the marked text. */
	citations?: CitationRequest[];
	/** Single-excerpt form of older content; use `citations` for new content. */
	quote?: string;
	source?: string;
}

export const Cite = ({ children, citations, quote, source }: CiteProps) => {
	const { areCitationsHighlighted, onCitationSelect } = useMarkdocInteraction();
	const { citations: valid, problems } = readCiteCitations({ citations, quote, source });
	const isValid = !problems.length && !hasUnsupportedCitationChild(children);
	const canSelect = isValid && Boolean(onCitationSelect);
	const selectCitation = () => {
		if (isValid) {
			onCitationSelect?.(valid);
		}
	};
	const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}
		event.preventDefault();
		selectCitation();
	};

	return (
		<mark
			aria-invalid={isValid ? undefined : true}
			className={getCitationClassName(areCitationsHighlighted, canSelect)}
			data-citation-quote={valid[0]?.quote}
			data-citation-source={valid[0]?.source}
			data-invalid-citation={isValid ? undefined : "true"}
			onClick={canSelect ? selectCitation : undefined}
			onKeyDown={canSelect ? handleKeyDown : undefined}
			role={canSelect ? "button" : undefined}
			tabIndex={canSelect ? 0 : undefined}
			title={isValid ? undefined : "Invalid citation source"}
		>
			{children}
		</mark>
	);
};
