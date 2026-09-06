import type { Database } from "@repo/database";
import * as schema from "@repo/database/schema";
import { hashPassword } from "better-auth/crypto";

import { encryptApiKey } from "../lib/encryption-core";

type SeedTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Constants for test credentials
const SEED_USER = {
	email: "test@test.com",
	name: "Test User",
	password: "password123",
	username: "testuser",
} as const;

// Global flag to prevent re-seeding during HMR
const globalForSeed = globalThis as unknown as {
	seeded: boolean | undefined;
};

// Synthetic development examples. Clinical decisions remain placeholders and
// must be completed from the facts of an individual case.
const SEED_TEMPLATES = [
	{
		category: "Prozeduren",
		content: `Aufklärung liegt vor, aktuelle Gerinnungswerte wurden geprüft.

Lagerung des Pat. sowie Monitoring von Blutdruck, EKG, SpO2, AF.

Lokalanästhesie mit {% info "Lokale volumen" type="string" unit="ml" /%} Mecain. Sonographisch gesteuerte Punktion der V. jugularis interna rechts unter sonographischer Kontrolle nach sterilen Kautelen. Einbringen einer 8,5-Fr. x 4" (10cm) Arrow-Flex Schleuse in Seldinger Technik. Hierüber Einschwemmen eines 7-Fr. Swan-Ganz-Katheters zur Durchführung der Druckmessung, HZV-Messung sowie Etagenoxymetrie.

Lagekontrolle mittels Druckkurven.

Am Ende der Untersuchung Entfernen des Katheters und der Schleuse.

Anlage eines sterilen Wundverbandes.

Uhrzeit Beginn Untersuchung: {% info "Uhrzeit_Beginn_Untersuchung" type="string" /%} Uhr; Uhrzeit Ende Untersuchung: {% info "Uhrzeit_Ende_Untersuchung" type="string" /%} Uhr.

**Rechtsherzkatheteruntersuchung** vom {% info "Datum" type="date" /%}:
Laufende Untersuchungsnummer: {% info "Laufende_Untersuchungsnummer" type="string" /%} Indikation: {% info "Indikation" type="string" /%} O²-Gabe: {% info "O2_Gabe" type="string" /%} Körpergröße: {% info "Koerpergroesse_cm" type="number" unit="cm" /%} cm, Gewicht: {% info "Gewicht_kg" type="number" unit="kg" /%} kg, KÖF: {% calc primary="KOEF" formula="0.007184 * ([Koerpergroesse_cm] ^ 0.725) * ([Gewicht_kg] ^ 0.425)" unit="m²" %}{% info "Koerpergroesse_cm" type="number" unit="cm" /%}{% info "Gewicht_kg" type="number" unit="kg" /%}{% /calc %} m². Atemfrequenz: {% info "Atemfrequenz" type="number" unit="/min" /%} /min.

Werte in Ruhe: ZVD {% info "ZVD_mmHg" type="number" unit="mmHg" /%}mmHg, RA {% info "RA_mmHg" type="number" unit="mmHg" /%}mmHg, RV {% info "RV_Systole_mmHg" type="number" unit="mmHg" /%}/{% info "RV_Diastole_mmHg" type="number" unit="mmHg" /%} ({% info "RV_Mitteldruck_mmHg" type="number" unit="mmHg" /%})mmHg, PAP {% info "PAP_Systole_mmHg" type="number" unit="mmHg" /%}/{% info "PAP_Diastole_mmHg" type="number" unit="mmHg" /%} ({% calc primary="PAP_Mitteldruck_mmHg" formula="([PAP_Systole_mmHg] + 2 * [PAP_Diastole_mmHg]) / 3" unit="mmHg" %}{% info "PAP_Systole_mmHg" type="number" unit="mmHg" /%}{% info "PAP_Diastole_mmHg" type="number" unit="mmHg" /%}{% /calc %})mmHg, PAWP {% info "PAWP_mmHg" type="number" unit="mmHg" /%}mmHg, HZV {% info "HZV_l_min" type="number" unit="l/min" /%}l/min, CI {% calc primary="CI_l_min_KOEF" formula="[HZV_l_min] / (0.007184 * ([Koerpergroesse_cm] ^ 0.725) * ([Gewicht_kg] ^ 0.425))" unit="l/min/KÖF" %}{% info "HZV_l_min" type="number" unit="l/min" /%}{% info "Koerpergroesse_cm" type="number" unit="cm" /%}{% info "Gewicht_kg" type="number" unit="kg" /%}{% /calc %}l/min/KÖF, SV {% calc primary="SV_ml" formula="[HZV_l_min] * 1000 / [Herzfrequenz_min]" unit="ml" %}{% info "HZV_l_min" type="number" unit="l/min" /%}{% info "Herzfrequenz_min" type="number" unit="/min" /%}{% /calc %}ml, SVI {% calc primary="SVI_ml_m2" formula="([HZV_l_min] * 1000 / [Herzfrequenz_min]) / (0.007184 * ([Koerpergroesse_cm] ^ 0.725) * ([Gewicht_kg] ^ 0.425))" unit="ml/m²" %}{% info "HZV_l_min" type="number" unit="l/min" /%}{% info "Herzfrequenz_min" type="number" unit="/min" /%}{% info "Koerpergroesse_cm" type="number" unit="cm" /%}{% info "Gewicht_kg" type="number" unit="kg" /%}{% /calc %}ml/m², PAC {% calc primary="PAC_ml_mmHg" formula="([HZV_l_min] * 1000 / [Herzfrequenz_min]) / ([PAP_Systole_mmHg] - [PAP_Diastole_mmHg])" unit="ml/mmHg" %}{% info "HZV_l_min" type="number" unit="l/min" /%}{% info "Herzfrequenz_min" type="number" unit="/min" /%}{% info "PAP_Systole_mmHg" type="number" unit="mmHg" /%}{% info "PAP_Diastole_mmHg" type="number" unit="mmHg" /%}{% /calc %}ml/mmHg, Herzfrequenz {% info "Herzfrequenz_min" type="number" unit="/min" /%}/min., PVR {% calc primary="PVR_dyn_s_cm_5" formula="80 * ((([PAP_Systole_mmHg] + 2 * [PAP_Diastole_mmHg]) / 3) - [PAWP_mmHg]) / [HZV_l_min]" unit="dyn xs x cm -5" %}{% info "PAP_Systole_mmHg" type="number" unit="mmHg" /%}{% info "PAP_Diastole_mmHg" type="number" unit="mmHg" /%}{% info "PAWP_mmHg" type="number" unit="mmHg" /%}{% info "HZV_l_min" type="number" unit="l/min" /%}{% /calc %}dyn xs x cm -5, SVR {% calc primary="SVR_dyn_s_cm_5" formula="80 * ((([SystAP_Systole_mmHg] + 2 * [SystAP_Diastole_mmHg]) / 3) - [RA_mmHg]) / [HZV_l_min]" unit="dyn xs x cm-5" %}{% info "SystAP_Systole_mmHg" type="number" unit="mmHg" /%}{% info "SystAP_Diastole_mmHg" type="number" unit="mmHg" /%}{% info "RA_mmHg" type="number" unit="mmHg" /%}{% info "HZV_l_min" type="number" unit="l/min" /%}{% /calc %}dyn xs x cm-5‚ Sättigung {% info "Saettigung_Prozent" type="number" unit="%" /%}%, zentral venöse Sättigung {% info "Zentralvenoese_Saettigung_Prozent" type="number" unit="%" /%}%. Syst.AP {% info "SystAP_Systole_mmHg" type="number" unit="mmHg" /%}/{% info "SystAP_Diastole_mmHg" type="number" unit="mmHg" /%}({% calc primary="SystAP_Mitteldruck_mmHg" formula="([SystAP_Systole_mmHg] + 2 * [SystAP_Diastole_mmHg]) / 3" unit="mmHg" %}{% info "SystAP_Systole_mmHg" type="number" unit="mmHg" /%}{% info "SystAP_Diastole_mmHg" type="number" unit="mmHg" /%}{% /calc %})mmHg.

Zusammenfassung: {% info "Beurteilung" type="string" /%}
`,
		title: "Rechtsherzkatheter",
	},
	{
		category: "Anamnese",
		content: `# Pneumonie - Aufnahmeanamnese

## Aktuelle Beschwerden
- Husten seit __ Tagen
- Auswurf: (klar/gelb/grünlich/blutig)
- Fieber: max __ °C
- Dyspnoe: (Belastungs-/Ruhedyspnoe)
- Thoraxschmerzen: (atemabhängig ja/nein)

## Risikofaktoren
- Rauchen: __ PY
- Immunsuppression
- Aspiration`,
		title: "Pneumonie Aufnahme",
	},
	{
		category: "Entlassbrief",
		content: `# Entlassbrief - Herzinsuffizienz

## Diagnosen
1. Dekompensierte Herzinsuffizienz (NYHA-Klasse nach Befund: __)
2. [Weitere Diagnosen]

## Verlauf
Patient wurde wegen kardialer Dekompensation stationär aufgenommen.
Unter diuretischer Therapie zeigte sich eine rasche Rekompensation.

## Medikation bei Entlassung
- [Medikamentenliste]

## Empfehlungen
- [Individuell indizierte Trinkmenge: __]
- [Gewichtskontrollen nach individueller Empfehlung: __]
- [Ambulante Verlaufskontrolle mit festgelegtem Intervall: __]`,
		title: "Herzinsuffizienz Entlassbrief",
	},
	{
		category: "Diagnoseblock",
		content: `## Diagnoseblock
E11.9 Diabetes mellitus Typ 2 ohne Komplikationen
- HbA1c: ___%
- Medikation bei Entlassung: [aus dem Medikationsplan übernehmen]
- Beratung: [nur dokumentieren, wenn erfolgt]`,
		title: "Diabetes Mellitus Typ 2",
	},
	{
		category: "ICU-Transfer",
		content: `# Intensivverlegung - ARDS

## Verlegungsgrund
Respiratorische Insuffizienz mit Intubationspflicht

## Aktuelle Beatmung
- Modus: BIPAP
- FiO2: __%
- PEEP: __ mbar
- pO2/FiO2: __

## Katecholamine
- Noradrenalin: __ µg/kg/min

## Offene Maßnahmen
- [Ausstehende Diagnostik: __]
- [Geplante Maßnahmen: __]`,
		title: "Intensivverlegung ARDS",
	},
];

/**
 * Seed templates into the database
 */
const seedTemplates = async (db: SeedTransaction, authorId: string): Promise<void> => {
	console.log("Seeding templates...");

	for (const tmpl of SEED_TEMPLATES) {
		await db.insert(schema.template).values({
			authorId,
			category: tmpl.category,
			content: tmpl.content,
			id: crypto.randomUUID(),
			title: tmpl.title,
		});
	}

	console.log(`Seeded ${SEED_TEMPLATES.length} templates`);
};

/**
 * Seed usage events into the database
 */
const seedUsageEvents = async (db: SeedTransaction, userId: string): Promise<void> => {
	console.log("Seeding usage events...");

	const events = [
		{
			daysAgo: 0,
			inputTokens: 1500,
			model: "anthropic/claude-3.5-sonnet",
			name: "ai_scribe_generation",
			outputTokens: 800,
		},
		{
			daysAgo: 1,
			inputTokens: 2200,
			model: "anthropic/claude-3.5-sonnet",
			name: "ai_scribe_generation",
			outputTokens: 1200,
		},
		{
			daysAgo: 2,
			inputTokens: 1800,
			model: "google/gemini-2.0-flash-exp",
			name: "ai_scribe_generation",
			outputTokens: 950,
		},
		{
			daysAgo: 3,
			inputTokens: 3000,
			model: "anthropic/claude-3.5-sonnet",
			name: "ai_scribe_generation",
			outputTokens: 1500,
		},
		{
			daysAgo: 5,
			inputTokens: 1200,
			model: "google/gemini-2.0-flash-exp",
			name: "ai_scribe_generation",
			outputTokens: 600,
		},
	];

	for (const event of events) {
		const timestamp = new Date();
		timestamp.setDate(timestamp.getDate() - event.daysAgo);

		await db.insert(schema.usageEvent).values({
			cost: ((event.inputTokens * 0.003 + event.outputTokens * 0.015) / 1000).toFixed(6),
			id: crypto.randomUUID(),
			inputTokens: event.inputTokens,
			model: event.model,
			name: event.name,
			outputTokens: event.outputTokens,
			timeToCompletionMs: Math.round(event.outputTokens * 35),
			timeToFirstTokenMs: 1200 + event.daysAgo * 75,
			timestamp,
			totalTokens: event.inputTokens + event.outputTokens,
			userId,
		});
	}

	console.log(`Seeded ${events.length} usage events`);
};

const seedAiProviders = async (db: SeedTransaction): Promise<void> => {
	const providers = [
		["OPENROUTER_API_KEY", "OpenRouter", "openrouter", "https://openrouter.ai/api/v1"],
		["ANTHROPIC_API_KEY", "Anthropic", "anthropic", "https://api.anthropic.com/v1"],
		["OPENAI_API_KEY", "OpenAI", "openai", "https://api.openai.com/v1"],
		["MISTRAL_API_KEY", "Mistral", "openai-compatible", "https://api.mistral.ai/v1"],
		["TINFOIL_API_KEY", "Tinfoil", "tinfoil", "https://inference.tinfoil.sh/v1"],
	] as const;

	for (const [variable, name, protocol, baseUrl] of providers) {
		const apiKey = process.env[variable]?.trim();
		// Older orb setup scripts supplied this placeholder even without a real key.
		if (!apiKey || apiKey === "orb-placeholder") {
			continue;
		}
		await db.insert(schema.aiProvider).values({
			apiKey: await encryptApiKey(apiKey, process.env.BETTER_AUTH_SECRET ?? ""),
			baseUrl,
			name,
			protocol,
		});
		console.log(`Seeded AI provider: ${name}`);
	}
};

/**
 * Seed the database with test data for local development
 * Only runs once, even across HMR reloads
 */
export const seedDatabase = async (db: Database): Promise<void> => {
	if (process.env.MDSCRIBE_ALLOW_DEV_SEED !== "1") {
		console.log("Development seed disabled; skipping.");
		return;
	}
	if (process.env.NODE_ENV !== "development") {
		throw new Error("Development seed data requires NODE_ENV=development.");
	}

	// Skip if already seeded (HMR protection)
	if (globalForSeed.seeded) {
		console.log("Database already seeded, skipping...");
		return;
	}

	const [existingUser] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
	if (existingUser) {
		globalForSeed.seeded = true;
		console.log("Database already contains user data, skipping seed.");
		return;
	}

	console.log("Seeding database with test data...");

	await db.transaction(async (transaction) => {
		const now = new Date();
		const userId = crypto.randomUUID();
		await transaction.insert(schema.user).values({
			displayUsername: SEED_USER.username,
			email: SEED_USER.email,
			emailVerified: true,
			id: userId,
			name: SEED_USER.name,
			stripeCustomerId: `cus_test_${Date.now()}`,
			updatedAt: now,
			username: SEED_USER.username,
		});

		const hashedPassword = await hashPassword(SEED_USER.password);
		await transaction.insert(schema.account).values({
			accountId: userId,
			id: crypto.randomUUID(),
			password: hashedPassword,
			providerId: "credential",
			updatedAt: now,
			userId,
		});

		await transaction.insert(schema.session).values({
			// 30 days
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			id: crypto.randomUUID(),
			ipAddress: "127.0.0.1",
			token: crypto.randomUUID(),
			updatedAt: now,
			userAgent: "seed-script",
			userId,
		});

		await seedTemplates(transaction, userId);
		await seedUsageEvents(transaction, userId);
		await seedAiProviders(transaction);
	});

	// Mark as seeded
	globalForSeed.seeded = true;
	console.log("Database seeding complete!");
	console.log(`Test user: ${SEED_USER.email} / ${SEED_USER.password}`);
};

if (import.meta.main) {
	const { database } = await import("@repo/database/client");
	try {
		await seedDatabase(database);
	} catch (error) {
		console.error("Database seed failed:", error);
		process.exitCode = 1;
	} finally {
		await database.$client.end({ timeout: 5 });
	}
}
