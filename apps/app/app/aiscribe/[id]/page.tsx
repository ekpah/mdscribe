import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AiscribeTemplate } from "@/app/aiscribe/_components/aiscribe-template";
import { DoctorsNoteEditor } from "@/app/aiscribe/_components/doctors-note-editor";
import { redirectLegacyAiscribePath } from "@/app/aiscribe/_lib/legacy-redirect";
import { getTemplateSections } from "@/features/template-tags/sections";
import { doctorsNoteAgentFlag, unifiedAiscribeFlag } from "@/flags";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";
import { LEGACY_BUILT_IN_TITLES } from "@/orpc/aiscribe-redirects";

const getTemplate = (id: string) =>
	getQueryClient().fetchQuery(orpc.templates.get.queryOptions({ input: { id } }));

interface AiscribeTemplatePageProps {
	params: Promise<{ id: string }>;
}

export const generateMetadata = async (props: AiscribeTemplatePageProps): Promise<Metadata> => {
	const { id } = await props.params;
	const template = await getTemplate(id);
	return { title: template ? `AI Scribe · ${template.title}` : "AI Scribe" };
};

/**
 * Generates text from a template. A template with several `{% section %}`
 * blocks opens as a letter editor with one field per section; any other
 * template opens the single-text AI Scribe page, or behind the admin preview
 * flag the letter editor with the whole template as its one section.
 */
export default async function AiscribeTemplatePage(props: AiscribeTemplatePageProps) {
	const { id } = await props.params;
	if (Object.hasOwn(LEGACY_BUILT_IN_TITLES, id)) {
		return redirectLegacyAiscribePath("builtin", [id]);
	}
	const template = await getTemplate(id);
	if (!template) {
		notFound();
	}

	const templateSections = getTemplateSections(template.content);
	if (templateSections.length > 0 || (await unifiedAiscribeFlag())) {
		// The model answers a template without sections unframed; that answer fills this one field.
		const sections = templateSections.length
			? templateSections
			: [{ id: "text", title: template.title }];
		return (
			<DoctorsNoteEditor
				sections={sections.map((section) => ({
					id: section.id,
					label: section.title,
					placeholder: `${section.title} eingeben oder diktieren …`,
				}))}
				showAgent={await doctorsNoteAgentFlag()}
				templateId={template.id}
				title={template.title}
			/>
		);
	}

	return (
		<AiscribeTemplate
			config={{
				author: template.author?.name ?? "MDScribe",
				templateId: template.id,
				title: template.title,
			}}
		/>
	);
}
