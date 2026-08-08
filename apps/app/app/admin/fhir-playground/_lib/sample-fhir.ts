const KVNR_SYSTEM = "http://fhir.de/sid/gkv/kvid-10";
const EXAMPLE_KVNR = "G995030566";
const LAB_PROFILE_BASE = "https://fhir.kbv.de/StructureDefinition";

interface LabValues {
	creatinine: number;
	hba1c: number;
	hemoglobin: number;
}

interface LabDocumentOptions {
	date: string;
	documentNumber: "1" | "2";
	reportNumber: string;
	values: LabValues;
}

const createLabDocument = ({ date, documentNumber, reportNumber, values }: LabDocumentOptions) => {
	const fullUrl = (suffix: number): string =>
		`urn:uuid:${documentNumber}0000000-0000-4000-8000-00000000000${suffix}`;
	const utcOffset = date.slice(5, 7) === "01" ? "+01:00" : "+02:00";
	const timestamp = `${date}T12:30:00${utcOffset}`;
	const effectiveDateTime = `${date}T09:00:00${utcOffset}`;
	const patientReference = fullUrl(2);
	const specimenReference = fullUrl(4);
	const organizationReference = fullUrl(8);
	const observation = ({
		code,
		display,
		id,
		text,
		unit,
		value,
	}: {
		code: string;
		display: string;
		id: string;
		text: string;
		unit: string;
		value: number;
	}) => ({
		resource: {
			category: [
				{
					coding: [
						{
							code: "laboratory",
							system: "http://terminology.hl7.org/CodeSystem/observation-category",
						},
					],
				},
			],
			code: {
				coding: [{ code, display, system: "http://loinc.org" }],
				text,
			},
			effectiveDateTime,
			id,
			issued: `${date}T11:45:00${utcOffset}`,
			meta: {
				profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Observation_Laboratory_Study`],
				source: fullUrl(0),
			},
			performer: [{ reference: organizationReference }],
			resourceType: "Observation",
			specimen: { reference: specimenReference },
			status: "final",
			subject: { reference: patientReference },
			valueQuantity: {
				code: unit,
				system: "http://unitsofmeasure.org",
				unit,
				value,
			},
		},
	});
	const hemoglobin = observation({
		code: "718-7",
		display: "Hemoglobin [Mass/volume] in Blood",
		id: `hb-${date}`,
		text: "Hämoglobin (Hb)",
		unit: "g/dL",
		value: values.hemoglobin,
	});
	const hba1c = observation({
		code: "4548-4",
		display: "Hemoglobin A1c/Hemoglobin.total in Blood",
		id: `hba1c-${date}`,
		text: "HbA1c",
		unit: "%",
		value: values.hba1c,
	});
	const creatinine = observation({
		code: "2160-0",
		display: "Creatinine [Mass/volume] in Serum or Plasma",
		id: `creatinine-${date}`,
		text: "Kreatinin",
		unit: "mg/dL",
		value: values.creatinine,
	});

	return {
		fullUrl: fullUrl(0),
		// eslint-disable-next-line sort-keys -- Keep the conventional FHIR resource header order in the displayed JSON.
		resource: {
			resourceType: "Bundle",
			id: `mio-laborbefund-${date}`,
			meta: { profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Bundle`] },
			identifier: { system: "urn:ietf:rfc:3986", value: fullUrl(0) },
			type: "document",
			timestamp,
			entry: [
				{
					fullUrl: fullUrl(1),
					resource: {
						author: [{ reference: organizationReference }],
						date: timestamp,
						id: `lab-composition-${date}`,
						meta: {
							profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Composition`],
						},
						resourceType: "Composition",
						section: [
							{
								entry: [{ reference: fullUrl(3) }],
								title: "Laborbefund",
							},
						],
						status: "final",
						subject: { reference: patientReference },
						title: `MIO Laborbefund vom ${date.split("-").toReversed().join(".")}`,
						type: {
							coding: [
								{
									code: "11502-2",
									display: "Laboratory report",
									system: "http://loinc.org",
								},
							],
							text: "Laborbefund",
						},
					},
				},
				{
					fullUrl: patientReference,
					resource: {
						birthDate: "1954-02-27",
						gender: "female",
						id: `lab-patient-${date}`,
						identifier: [{ system: KVNR_SYSTEM, value: EXAMPLE_KVNR }],
						meta: { profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Patient`] },
						name: [{ family: "Gundlach", given: ["Monika"], use: "official" }],
						resourceType: "Patient",
					},
				},
				{
					fullUrl: fullUrl(3),
					resource: {
						category: [
							{
								coding: [
									{
										code: "LAB",
										display: "Laboratory",
										system: "http://terminology.hl7.org/CodeSystem/v2-0074",
									},
								],
							},
						],
						code: {
							coding: [
								{
									code: "11502-2",
									display: "Laboratory report",
									system: "http://loinc.org",
								},
							],
							text: "Laborbefund",
						},
						conclusion:
							documentNumber === "1"
								? "HbA1c oberhalb des Referenzbereichs."
								: "HbA1c im Vergleich zum Vorbefund rückläufig.",
						effectiveDateTime,
						id: `lab-report-${date}`,
						identifier: [{ system: "https://labor.example/befundnummer", value: reportNumber }],
						issued: `${date}T12:20:00${utcOffset}`,
						meta: { profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_DiagnosticReport`] },
						performer: [{ reference: organizationReference }],
						resourceType: "DiagnosticReport",
						result: [
							{ reference: fullUrl(5) },
							{ reference: fullUrl(6) },
							{ reference: fullUrl(7) },
						],
						specimen: [{ reference: specimenReference }],
						status: "final",
						subject: { reference: patientReference },
					},
				},
				{
					fullUrl: specimenReference,
					resource: {
						collection: { collectedDateTime: `${date}T08:45:00${utcOffset}` },
						id: `serum-${date}`,
						meta: { profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Specimen`] },
						resourceType: "Specimen",
						status: "available",
						subject: { reference: patientReference },
						type: {
							coding: [
								{
									code: "119364003",
									display: "Serum specimen",
									system: "http://snomed.info/sct",
								},
							],
							text: "Serum",
						},
					},
				},
				{ ...hemoglobin, fullUrl: fullUrl(5) },
				{ ...hba1c, fullUrl: fullUrl(6) },
				{ ...creatinine, fullUrl: fullUrl(7) },
				{
					fullUrl: organizationReference,
					resource: {
						address: [
							{
								city: "Berlin",
								country: "D",
								line: ["Musterstraße 12"],
								postalCode: "10115",
							},
						],
						id: `labor-berlin-${date}`,
						identifier: [
							{
								system: "https://fhir.kbv.de/NamingSystem/KBV_NS_Base_BSNR",
								value: "721111100",
							},
						],
						meta: { profile: [`${LAB_PROFILE_BASE}/KBV_PR_MIO_LAB_Organization`] },
						name: "MVZ Labor Berlin-Mitte (Beispiel)",
						resourceType: "Organization",
					},
				},
			],
		},
	};
};

// eslint-disable-next-line sort-keys -- Keep the conventional FHIR Bundle header order in the displayed JSON.
const sample = {
	resourceType: "Bundle",
	id: "synthetic-epa-patient-export",
	meta: {
		tag: [
			{
				code: "synthetic",
				display: "Synthetische Beispieldaten",
				system: "https://mdscribe.app/fhir/CodeSystem/example-data",
			},
		],
	},
	type: "collection",
	timestamp: "2025-07-18T10:15:00+02:00",
	entry: [
		{
			fullUrl: "https://epa.example/epa/patient/api/v1/fhir/Patient/ExampleEPAPatient",
			resource: {
				active: true,
				birthDate: "1954-02-27",
				gender: "female",
				id: "ExampleEPAPatient",
				identifier: [{ system: KVNR_SYSTEM, value: EXAMPLE_KVNR }],
				meta: {
					lastUpdated: "2025-07-18T08:00:00Z",
					profile: ["https://gematik.de/fhir/epa/StructureDefinition/epa-patient"],
					versionId: "3",
				},
				name: [
					{ family: "Gundlach", given: ["Monika"], prefix: ["Dr."], use: "official" },
					{ family: "Blohm", use: "maiden" },
				],
				resourceType: "Patient",
			},
		},
		createLabDocument({
			date: "2025-01-15",
			documentNumber: "1",
			reportNumber: "LAB-2025-000184",
			values: { creatinine: 1.08, hba1c: 7.4, hemoglobin: 12.8 },
		}),
		createLabDocument({
			date: "2025-07-17",
			documentNumber: "2",
			reportNumber: "LAB-2025-008731",
			values: { creatinine: 0.92, hba1c: 6.5, hemoglobin: 13.4 },
		}),
		{
			fullUrl:
				"http://epa4all/epa/medication/api/v1/fhir/Medication/2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
			resource: {
				amount: {
					denominator: { code: "{Tablet}", unit: "Tablet", value: 1 },
					numerator: { code: "mg", unit: "MilliGram", value: 100 },
				},
				code: {
					coding: [
						{
							code: "03953522",
							display: "Metoprolol-ratiopharm® 100 mg Tabletten",
							system: "http://fhir.de/CodeSystem/ifa/pzn",
						},
						{
							code: "C07AB02",
							display: "Metoprolol",
							system: "http://fhir.de/CodeSystem/bfarm/atc",
						},
					],
				},
				extension: [
					{
						url: "https://gematik.de/fhir/epa-medication/StructureDefinition/rx-prescription-process-identifier-extension",
						valueIdentifier: {
							system:
								"https://gematik.de/fhir/epa-medication/sid/rx-prescription-process-identifier",
							value: "160.153.303.260.460_202508220",
						},
					},
				],
				form: { coding: [{ code: "TAB", display: "Tabletten" }] },
				id: "2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
				meta: {
					lastUpdated: "2025-07-17T14:05:00Z",
					profile: ["https://gematik.de/fhir/epa-medication/StructureDefinition/epa-medication"],
					source: "https://erp.zentral.erp.splitdns.ti-dienste.de",
					versionId: "2",
				},
				resourceType: "Medication",
				status: "active",
			},
		},
		{
			fullUrl:
				"http://epa4all/epa/medication/api/v1/fhir/MedicationRequest/84d15d68-2df4-4cae-b608-95c9204b3ec7",
			resource: {
				authoredOn: "2025-07-17",
				dispenseRequest: {
					quantity: {
						code: "{Tablet}",
						system: "http://unitsofmeasure.org",
						unit: "Tabletten",
						value: 100,
					},
					validityPeriod: { end: "2025-10-16", start: "2025-07-17" },
				},
				dosageInstruction: [{ text: "1 Tablette morgens und abends" }],
				id: "84d15d68-2df4-4cae-b608-95c9204b3ec7",
				intent: "order",
				medicationReference: {
					display: "Metoprolol-ratiopharm® 100 mg Tabletten",
					reference:
						"http://epa4all/epa/medication/api/v1/fhir/Medication/2d5a0317-b2df-4d7b-ad72-07f5f66f9f12",
				},
				meta: {
					lastUpdated: "2025-07-17T14:05:00Z",
					profile: [
						"https://gematik.de/fhir/epa-medication/StructureDefinition/epa-medication-request",
					],
					versionId: "1",
				},
				resourceType: "MedicationRequest",
				status: "active",
				subject: { identifier: { system: KVNR_SYSTEM, value: EXAMPLE_KVNR } },
			},
		},
	],
};

const resourceTypeFirst = (_key: string, value: unknown): unknown => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return value;
	}
	const record = value as Record<string, unknown>;
	if (!("resourceType" in record)) {
		return value;
	}
	const { resourceType, ...properties } = record;
	return { resourceType, ...properties };
};

export const EPA_SAMPLE_FHIR = JSON.stringify(sample, resourceTypeFirst, 2);
