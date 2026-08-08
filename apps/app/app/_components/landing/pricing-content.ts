export const pricingContent = {
	billing: {
		monthly: "Monatlich",
		yearly: "Jährlich",
		yearlyDiscount: "(-17%)",
	},
	description:
		"Teste MDScribe kostenlos und baue dir passende Vorlagen für deine Dokumentation – wenn es dir gefällt, nutze das Self-Hosting um deine Dokumentation effizienter zu machen.",
	heading: "Starte kostenlos mit KI",
	plans: {
		free: {
			cta: "Kostenlos starten",
			description: "Perfekt zum Ausprobieren",
			features: [
				{ icon: "check", label: "Teste die KI-Funktionen mit anonymen Inhalten" },
				{ icon: "check", label: "Eigene Templates erstellen" },
				{ icon: "check", label: "Dokumente optimieren" },
				{ icon: "check", label: "Textbaustein Community" },
			],
			name: "MDScribe Free",
			price: "Kostenlos",
			priceDetail: "Für immer kostenlos",
		},
		plus: {
			cta: "Upgrade zu Plus",
			description: "Nutze MDScribe um noch bessere Vorlagen vorzubereiten",
			features: [
				{ emphasized: true, icon: "check", label: "Alle kostenlosen Features" },
				{ icon: "check", label: "Erhöhtes monatliches KI-Kontingent" },
				{ icon: "check", label: "Vollständige KI-Unterstützung" },
				{ icon: "check", label: "Unterstütze die Entwicklung von MDScribe" },
			],
			monthlyPrice: "9",
			monthlyPriceDetail: "Monatlich kündbar",
			name: "MDScribe Plus",
			priceUnit: "/Monat",
			yearlyPrice: "7,50",
			yearlyPriceDetail: "Jährlich abgerechnet",
		},
		selfHosted: {
			cta: "GitHub",
			description: "Volle Kontrolle für deine Dokumentation",
			features: [
				{ emphasized: true, icon: "code", label: "Quelloffen (Elastic-2.0)" },
				{ icon: "check", label: "Eigene API-Keys" },
				{ icon: "check", label: "Lokale KI-Modelle" },
				{ icon: "server", label: "Volle Datenkontrolle" },
				{ icon: "check", label: "Community Support" },
			],
			name: "Self-Hosting",
			price: "Kostenlos",
		},
	},
} as const;

export type PricingFeature =
	(typeof pricingContent.plans)[keyof typeof pricingContent.plans]["features"][number];
