import type { Database } from "@repo/database";
import type { JSONValue } from "ai";

import type { Session } from "@/lib/auth-types";
import type { ResolvedDefaultModelSelection } from "@/orpc/scribe/providers";

import type { ScribeAgentSection } from "../types";

/**
 * Everything a tool needs to act on the current letter and to run the standard
 * model. Shared across all agent tools so adding a new tool is just one file.
 */
export interface AgentToolDeps {
	db: Database;
	userId: string;
	sessionUser: Session["user"];
	activeSubscription: boolean;
	sections: ScribeAgentSection[];
	generation: ResolvedDefaultModelSelection;
	providerOptions: Record<string, Record<string, JSONValue>> | undefined;
	temperature?: number;
}

/**
 * Result shape every section-mutating tool returns. The client applies the
 * `content` to `sectionId` when `ok` is true.
 */
export interface SectionToolResult {
	ok: boolean;
	sectionId?: string;
	content?: string;
	error?: string;
}

export const findSection = (deps: AgentToolDeps, sectionId: string) =>
	deps.sections.find((section) => section.id === sectionId);
