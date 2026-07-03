import { sql } from "@repo/database";
import { database } from "@repo/database/client";

export const runtime = "nodejs";

export const GET = async (): Promise<Response> => {
	try {
		await database.execute(sql`select 1`);

		return Response.json({ database: "ok", status: "ok" }, { status: 200 });
	} catch (error) {
		console.error("Healthcheck failed", error);

		return Response.json({ database: "error", status: "error" }, { status: 503 });
	}
};
