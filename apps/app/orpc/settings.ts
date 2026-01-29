import { type } from "@orpc/server";
import type { AppSettings } from "@/lib/app-settings";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings-store";
import { authed, pub } from "@/orpc";
import { requiredAdminMiddleware } from "./middlewares/admin";

const getSettingsHandler = pub.handler(async () => getAppSettings());

const getAdminSettingsHandler = authed
	.use(requiredAdminMiddleware)
	.handler(async () => getAppSettings());

const updateSettingsHandler = authed
	.use(requiredAdminMiddleware)
	.input(type<AppSettings>())
	.handler(async ({ input }) => updateAppSettings(input));

export const settingsHandler = {
	get: getSettingsHandler,
};

export const adminSettingsHandler = {
	get: getAdminSettingsHandler,
	update: updateSettingsHandler,
};
