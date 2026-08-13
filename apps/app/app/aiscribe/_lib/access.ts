import { env } from "@/env";

import { getServerSession } from "@/lib/server-session";

export const getAiscribeIsAdmin = async (): Promise<boolean> => {
	const session = await getServerSession();
	return session?.user?.email === env.ADMIN_EMAIL;
};
