import { dedupe, flag } from "flags/next";
import { auth } from "./auth";
import { env } from "@repo/env";

interface Entities {
	user?: { id: string; email: string };
}

const identify = dedupe(
	async ({ headers }: { headers: Headers }): Promise<Entities> => {
		const session = await auth.api.getSession({
			headers: await headers,
		});
		return {
			user: session?.user
				? { id: session.user.id, email: session.user.email }
				: undefined,
		};
	},
);

export const allowAIUse = flag<boolean, Entities>({
	key: "allowAIUse",
	identify,
	decide: ({ entities }) => {
		const user = entities?.user;

		return (
			user?.email === env.ADMIN_EMAIL ||
			process.env.NODE_ENV === "development"
		);
	},
});

export const allowAdminAccess = flag<boolean, Entities>({
	key: "allowAdminAccess",
	identify,
	decide: ({ entities }) => {
		const user = entities?.user;
		return user?.email === env.ADMIN_EMAIL;
	},
});
