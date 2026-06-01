import { sql } from "@repo/database";
import { database } from "@repo/database/client";

export const runtime = "nodejs";

export const GET = async (): Promise<Response> => {
	try {
		await database.execute(sql`select 1`);
		return Response.json({ status: "ok" }, { status: 200 });
	} catch {
		return Response.json({ message: "database unavailable", status: "error" }, { status: 503 });
	}
};
