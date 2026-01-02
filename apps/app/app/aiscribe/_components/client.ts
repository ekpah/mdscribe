"use client";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { router } from "@/orpc/router";
import type { RouterClient } from "@orpc/server";

/**
 * Shared oRPC client for aiscribe components
 * Used with useChat transport for AI SDK integration
 */
const link = new RPCLink({
	url: `${typeof window !== "undefined" ? window.location.origin : ""}/api/rpc`,
});

export const client: RouterClient<typeof router> = createORPCClient(link);
