type AiscribeContextSectionKey =
	| "context"
	| "practitionerInfo"
	| "organizationInfo";

type AiscribeContextValue = string | number | boolean;

type AiscribeContextRecord = Record<
	string,
	AiscribeContextValue | AiscribeContextValue[] | null | undefined
>;

interface AiscribeContextEntry {
	label: string;
	value?: AiscribeContextValue | AiscribeContextValue[] | null;
}

type AiscribeContextSectionInput =
	| string
	| AiscribeContextRecord
	| AiscribeContextEntry[];

interface CreateAiscribeContextInput {
	context?: AiscribeContextSectionInput;
	practitionerInfo?: AiscribeContextSectionInput;
	organizationInfo?: AiscribeContextSectionInput;
}

interface AiscribeContextSection {
	key: AiscribeContextSectionKey;
	title: string;
	tag: string;
	content: string;
}

interface AiscribeContextResult {
	context: string;
	practitionerInfo: string;
	organizationInfo: string;
	sections: AiscribeContextSection[];
	prompt: string;
}

const SECTION_DEFINITIONS: Omit<AiscribeContextSection, "content">[] = [
	{
		key: "context",
		tag: "context",
		title: "Kontext",
	},
	{
		key: "practitionerInfo",
		tag: "practitioner_info",
		title: "Behandlerinformationen",
	},
	{
		key: "organizationInfo",
		tag: "organization_info",
		title: "Team/Organisation",
	},
];

const normalizeValue = (
	value: AiscribeContextValue | AiscribeContextValue[] | null | undefined,
): string => {
	if (value === null || value === undefined) {
		return "";
	}

	if (Array.isArray(value)) {
		const parts: string[] = [];
		for (const item of value) {
			const normalized = normalizeValue(item);
			if (normalized) {
				parts.push(normalized);
			}
		}
		return parts.join(", ");
	}

	if (typeof value === "string") {
		return value.trim();
	}

	return String(value);
};

const formatRecordSection = (record: AiscribeContextRecord): string => {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(record)) {
		const normalizedKey = key.trim();
		const normalizedValue = normalizeValue(value);
		if (!normalizedKey || !normalizedValue) {
			continue;
		}
		lines.push(`${normalizedKey}: ${normalizedValue}`);
	}
	return lines.join("\n");
};

const formatEntrySection = (entries: AiscribeContextEntry[]): string => {
	const lines: string[] = [];
	for (const entry of entries) {
		const normalizedLabel = entry.label.trim();
		const normalizedValue = normalizeValue(entry.value);
		if (!normalizedLabel || !normalizedValue) {
			continue;
		}
		lines.push(`${normalizedLabel}: ${normalizedValue}`);
	}
	return lines.join("\n");
};

const formatSectionInput = (
	input: AiscribeContextSectionInput | undefined,
): string => {
	if (!input) {
		return "";
	}

	if (typeof input === "string") {
		return input.trim();
	}

	if (Array.isArray(input)) {
		return formatEntrySection(input);
	}

	return formatRecordSection(input);
};

const getSectionContent = (
	key: AiscribeContextSectionKey,
	contents: Pick<
		AiscribeContextResult,
		"context" | "practitionerInfo" | "organizationInfo"
	>,
): string => {
	switch (key) {
		case "context": {
			return contents.context;
		}
		case "practitionerInfo": {
			return contents.practitionerInfo;
		}
		case "organizationInfo": {
			return contents.organizationInfo;
		}
		default: {
			return "";
		}
	}
};

const buildPrompt = (sections: AiscribeContextSection[]): string => {
	if (sections.length === 0) {
		return "";
	}

	const blocks: string[] = [];
	for (const section of sections) {
		blocks.push(
			`<${section.tag}>\n${section.content}\n</${section.tag}>`,
		);
	}

	return `<aiscribe_context>\n${blocks.join("\n\n")}\n</aiscribe_context>`;
};

export const createAiscribeContext = (
	input: CreateAiscribeContextInput,
): AiscribeContextResult => {
	const contents = {
		context: formatSectionInput(input.context),
		organizationInfo: formatSectionInput(input.organizationInfo),
		practitionerInfo: formatSectionInput(input.practitionerInfo),
	};

	const sections: AiscribeContextSection[] = [];
	for (const definition of SECTION_DEFINITIONS) {
		const content = getSectionContent(definition.key, contents);
		if (!content) {
			continue;
		}
		sections.push({ ...definition, content });
	}

	return {
		...contents,
		prompt: buildPrompt(sections),
		sections,
	};
};
