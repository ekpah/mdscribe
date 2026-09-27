"use client";

import type { ReactNode } from "react";

import { DEFAULT_DETAILS_SUMMARY } from "./helpers/config";

export interface DetailsProps {
	children?: ReactNode;
	open?: boolean;
	summary?: string;
}

/**
 * GitHub-style collapsed section. Renders native `<details>`/`<summary>`, so the
 * disclosure works without JavaScript and the document DOM matches GitHub's
 * rendering (no wrapper box, native disclosure marker).
 *
 * The summary marker is sized up slightly, and the section body reads with normal
 * line spacing: the first block loses its top margin and paragraphs lose the
 * blank-line gap between them.
 */
export const Details = ({ children, open = false, summary }: DetailsProps) => (
	<details
		className="mb-4 [&_p]:my-0 [&_summary+*]:mt-0"
		data-markdoc-details=""
		open={open}
	>
		<summary className="cursor-pointer marker:text-[1.2em]">
			{summary?.trim() || DEFAULT_DETAILS_SUMMARY}
		</summary>
		{children}
	</details>
);
