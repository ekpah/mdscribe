"use client";

import { MAX_CITATION_QUOTE_LENGTH } from "../../citations/resolvers/types";
import { useMarkdocInteraction } from "../../render/context/markdoc-interaction-context";
import { parseCitationSource } from "../../render/utils/citation-source";
import { Children, isValidElement } from "react";
import type { KeyboardEvent, ReactNode } from "react";

const getCitationClassName = (
	isHighlighted: boolean,
	canSelect: boolean,
): string =>
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
	quote?: string;
	source: string;
}

export const Cite = ({
	children,
	quote,
	source,
}: CiteProps) => {
	const { areCitationsHighlighted, onCitationSelect } = useMarkdocInteraction();
	const reference = parseCitationSource(source);
	const normalizedQuote = typeof quote === "string" && quote.trim() ? quote.trim() : undefined;
	const hasUnsupportedChild = hasUnsupportedCitationChild(children);
	const isValidQuote =
		quote === undefined ||
		(typeof quote === "string" && quote.length <= MAX_CITATION_QUOTE_LENGTH);
	const isValid = reference.kind !== "invalid" && !hasUnsupportedChild && isValidQuote;
	const canSelect = isValid && Boolean(onCitationSelect);
	const selectCitation = () => {
		if (reference.kind !== "invalid") {
			onCitationSelect?.({ quote: normalizedQuote, source: reference.source });
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
			data-citation-quote={normalizedQuote}
			data-citation-source={reference.kind === "invalid" ? undefined : reference.source}
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
