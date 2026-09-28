"use client";

import type { ReactNode } from "react";

import { DEFAULT_DETAILS_SUMMARY } from "./helpers/config";

export interface DetailsProps {
	children?: ReactNode;
	/** Continues the following line block: no paragraph gap below the section. */
	joinNext?: boolean;
	/** Continues the preceding line block: no paragraph gap above the section. */
	joinPrevious?: boolean;
	open?: boolean;
	summary?: string;
}

/**
 * GitHub-style collapsed section. Renders native `<details>`/`<summary>`, so the
 * disclosure works without JavaScript and the document DOM matches GitHub's
 * rendering (no wrapper box, native disclosure marker).
 *
 * The summary reads like one more line of text: it keeps the body font and line
 * height, and only the native marker sets it apart. A section written directly
 * below or above a paragraph (no blank line in the source) sits flush against it,
 * so a run of lines can mix plain lines and expandable ones. A blank line keeps
 * the normal paragraph gap. The section body reads with normal line spacing.
 */
export const Details = ({
	children,
	joinNext = false,
	joinPrevious = false,
	open = false,
	summary,
}: DetailsProps) => (
	<details
		className={[
			// Same gap as a prose paragraph, so an unjoined section spaces like one.
			"my-[1.25em] [&_p]:my-0 [&_summary+*]:mt-0 [&>:last-child]:mb-0",
			// Joined sides drop both this section's margin and the neighbour's.
			joinPrevious ? "mt-0 [:has(+&)]:mb-0" : "",
			joinNext ? "mb-0 [&+*]:mt-0" : "",
		]
			.filter(Boolean)
			.join(" ")}
		data-join-next={joinNext ? "" : undefined}
		data-join-previous={joinPrevious ? "" : undefined}
		data-markdoc-details=""
		open={open}
	>
		<summary className="cursor-pointer">{summary?.trim() || DEFAULT_DETAILS_SUMMARY}</summary>
		{children}
	</details>
);
