import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
	appSettingsSchema,
	defaultAppSettings,
	normalizeAppSettings,
	parseAppSettings,
	type AppSettings,
} from "./app-settings";

const settingsPath = path.join(process.cwd(), "app-settings.json");

const loadSettings = async (): Promise<AppSettings> => {
	try {
		const raw = await fs.readFile(settingsPath, "utf8");
		return parseAppSettings(JSON.parse(raw));
	} catch {
		return defaultAppSettings;
	}
};

export const getAppSettings = async (): Promise<AppSettings> => loadSettings();

export const updateAppSettings = async (
	input: unknown,
): Promise<AppSettings> => {
	const parsed = appSettingsSchema.parse(input);
	const normalized = normalizeAppSettings(parsed);

	await fs.writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`);

	return normalized;
};
