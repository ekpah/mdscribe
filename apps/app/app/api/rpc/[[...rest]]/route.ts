import { RPCHandler } from "@orpc/server/fetch";
import { router } from "@/orpc/router";

export const dynamic = "force-dynamic";

const handler = new RPCHandler(router);

const handleRequest = async (request: Request) => {
	const { response } = await handler.handle(request, {
		context: {},
		prefix: "/api/rpc",
	});
	return response ?? new Response("Not found", { status: 404 });
};

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
