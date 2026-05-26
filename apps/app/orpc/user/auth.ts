import { authed } from "@/orpc";

const getAuthContextHandler = authed.handler(({ context }) => ({
	isAdmin: context.auth.isAdmin,
}));

export const authHandler = {
	auth: getAuthContextHandler,
};
