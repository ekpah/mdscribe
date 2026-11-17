import "server-only";
import { flag } from "flags/next";
import type { Flag } from "flags/next";

import { auth } from "@/auth";
import { env } from "@/env";

// Release toggles for features that are not generally available yet.
// Authorization (admin pages, admin procedures) stays in the auth middleware:
// a flag value can be overridden, so it must never be the only access check.

interface FlagEntities {
	isAdmin: boolean;
}

export type BooleanFlag = Flag<boolean, FlagEntities>;

const identify = async ({ headers }: { headers: Headers }): Promise<FlagEntities> => {
	const session = await auth.api.getSession({ headers }).catch(() => null);
	return { isAdmin: session?.user.email === env.ADMIN_EMAIL };
};

export const templateAgentFlag = flag<boolean, FlagEntities>({
	// Admin-only preview.
	decide: ({ entities }) => Boolean(entities?.isAdmin),
	defaultValue: false,
	description: "AI agent in the template editor sidebar",
	identify,
	key: "template-agent",
});

export const unifiedAiscribeFlag = flag<boolean, FlagEntities>({
	// Admin-only preview.
	decide: ({ entities }) => Boolean(entities?.isAdmin),
	defaultValue: false,
	description: "AI Scribe opens every template in the letter editor, without sections as one",
	identify,
	key: "unified-aiscribe",
});

export const doctorsNoteAgentFlag = flag<boolean, FlagEntities>({
	// Hidden for everyone, the admin included, while the letter editor is reworked.
	decide: () => false,
	defaultValue: false,
	description: "MDScribe Agent beside the AI Scribe letter editor",
	identify,
	key: "doctors-note-agent",
});
