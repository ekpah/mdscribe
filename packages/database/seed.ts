import "server-only";

import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

// Constants for test credentials
export const SEED_USER = {
	email: "test@test.com",
	password: "password123",
	name: "Test User",
} as const;

// Global flag to prevent re-seeding during HMR
const globalForSeed = globalThis as unknown as {
	seeded: boolean | undefined;
};

// Template seed data
const SEED_TEMPLATES = [
	{
		title: "Akute Appendizitis",
		category: "Prozeduren",
		content: `# Appendektomie

## Indikation
Akute Appendizitis

## Vorgehen
- Laparoskopische Appendektomie in Allgemeinanästhesie
- Standardzugänge: 3-Trokar-Technik
- Präparation und Absetzung der Appendix

## Nachsorge
- Kostaufbau nach Toleranz
- Frühmobilisation
- Entlassung nach 1-2 Tagen bei komplikationslosem Verlauf`,
	},
	{
		title: "Pneumonie Aufnahme",
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
	},
	{
		title: "Herzinsuffizienz Entlassbrief",
		category: "Entlassbrief",
		content: `# Entlassbrief - Herzinsuffizienz

## Diagnosen
1. Dekompensierte Herzinsuffizienz (NYHA III)
2. [Weitere Diagnosen]

## Verlauf
Patient wurde wegen kardialer Dekompensation stationär aufgenommen.
Unter diuretischer Therapie zeigte sich eine rasche Rekompensation.

## Medikation bei Entlassung
- [Medikamentenliste]

## Empfehlungen
- Flüssigkeitsrestriktion 1.5L/Tag
- Tägliche Gewichtskontrolle
- Kardiologische Wiedervorstellung in 4 Wochen`,
	},
	{
		title: "Diabetes Mellitus Typ 2",
		category: "Diagnoseblock",
		content: `## Diagnoseblock
E11.9 Diabetes mellitus Typ 2 ohne Komplikationen
- HbA1c: ___%
- Metformin __ mg 1-0-1
- Diätberatung erfolgt`,
	},
	{
		title: "Intensivverlegung ARDS",
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
- CT Thorax ausstehend
- Bronchoskopie geplant`,
	},
];

/**
 * Seed templates into the database
 */
async function seedTemplates(
	db: PgliteDatabase<typeof schema>,
	authorId: string,
): Promise<void> {
	console.log("Seeding templates...");

	for (const tmpl of SEED_TEMPLATES) {
		await db.insert(schema.template).values({
			id: crypto.randomUUID(),
			title: tmpl.title,
			category: tmpl.category,
			content: tmpl.content,
			authorId,
			embedding: null,
		});
	}

	console.log(`Seeded ${SEED_TEMPLATES.length} templates`);
}

/**
 * Seed usage events into the database
 */
async function seedUsageEvents(
	db: PgliteDatabase<typeof schema>,
	userId: string,
): Promise<void> {
	console.log("Seeding usage events...");

	const events = [
		{
			name: "ai_scribe_generation",
			inputTokens: 1500,
			outputTokens: 800,
			model: "anthropic/claude-3.5-sonnet",
			daysAgo: 0,
		},
		{
			name: "ai_scribe_generation",
			inputTokens: 2200,
			outputTokens: 1200,
			model: "anthropic/claude-3.5-sonnet",
			daysAgo: 1,
		},
		{
			name: "ai_scribe_generation",
			inputTokens: 1800,
			outputTokens: 950,
			model: "google/gemini-2.0-flash-exp",
			daysAgo: 2,
		},
		{
			name: "ai_scribe_generation",
			inputTokens: 3000,
			outputTokens: 1500,
			model: "anthropic/claude-3.5-sonnet",
			daysAgo: 3,
		},
		{
			name: "ai_scribe_generation",
			inputTokens: 1200,
			outputTokens: 600,
			model: "google/gemini-2.0-flash-exp",
			daysAgo: 5,
		},
	];

	for (const event of events) {
		const timestamp = new Date();
		timestamp.setDate(timestamp.getDate() - event.daysAgo);

		await db.insert(schema.usageEvent).values({
			id: crypto.randomUUID(),
			userId,
			timestamp,
			name: event.name,
			inputTokens: event.inputTokens,
			outputTokens: event.outputTokens,
			totalTokens: event.inputTokens + event.outputTokens,
			model: event.model,
			cost: (
				(event.inputTokens * 0.003 + event.outputTokens * 0.015) /
				1000
			).toFixed(6),
		});
	}

	console.log(`Seeded ${events.length} usage events`);
}

/**
 * Seed the database with test data for local development
 * Only runs once, even across HMR reloads
 */
export async function seedDatabase(
	db: PgliteDatabase<typeof schema>,
): Promise<void> {
	// Skip if already seeded (HMR protection)
	if (globalForSeed.seeded) {
		console.log("Database already seeded, skipping...");
		return;
	}

	console.log("Seeding database with test data...");

	// Create test user
	const userId = crypto.randomUUID();
	await db.insert(schema.user).values({
		id: userId,
		email: SEED_USER.email,
		name: SEED_USER.name,
		emailVerified: true,
		stripeCustomerId: `cus_test_${Date.now()}`,
	});

	// Create credential account with hashed password
	const hashedPassword = await Bun.password.hash(SEED_USER.password);
	await db.insert(schema.account).values({
		id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: "credential",
		password: hashedPassword,
	});

	// Create active session for immediate login
	const sessionToken = crypto.randomUUID();
	await db.insert(schema.session).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
		ipAddress: "127.0.0.1",
		userAgent: "seed-script",
	});

	// Seed templates
	await seedTemplates(db, userId);

	// Seed usage events
	await seedUsageEvents(db, userId);

	// Mark as seeded
	globalForSeed.seeded = true;
	console.log("Database seeding complete!");
	console.log(`Test user: ${SEED_USER.email} / ${SEED_USER.password}`);
}
