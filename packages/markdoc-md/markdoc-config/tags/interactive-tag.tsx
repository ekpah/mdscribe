"use client";

import { useMarkdocInteraction } from "@repo/markdoc-md/render/context/markdoc-interaction-context";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";

const getInteractiveTagClassName = (isActive: boolean, canSelect: boolean) =>
	[
		"inline rounded-md border border-transparent px-1 transition-colors",
		canSelect ? "cursor-pointer hover:border-solarized-orange/40 hover:bg-solarized-orange/10" : "",
		isActive ? "border-solarized-orange/70 bg-solarized-orange/20 ring-2 ring-solarized-orange/20" : "",
	]
		.filter(Boolean)
		.join(" ");

export const InteractiveTag = ({
	children,
	tagName,
}: {
	children: ReactNode;
	tagName?: string | null;
}) => {
	const { activeTagName, onTagSelect } = useMarkdocInteraction();
	const elementRef = useRef<HTMLSpanElement | null>(null);
	const canSelect = Boolean(onTagSelect);
	const isActive = Boolean(tagName && activeTagName === tagName);

	useLayoutEffect(() => {
		if (!isActive) {
			return;
		}
		elementRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
	}, [isActive]);

	if (!tagName) {
		return <>{children}</>;
	}

	return (
		<span
			className={getInteractiveTagClassName(isActive, canSelect)}
			data-active={isActive ? "true" : undefined}
			data-markdoc-input={tagName}
			onClick={canSelect ? () => onTagSelect?.(tagName) : undefined}
			onKeyDown={
				canSelect
					? (event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								onTagSelect?.(tagName);
							}
						}
					: undefined
			}
			ref={elementRef}
			role={canSelect ? "button" : undefined}
			tabIndex={canSelect ? 0 : undefined}
		>
			{children}
		</span>
	);
};
