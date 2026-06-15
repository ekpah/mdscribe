import { notFound } from "next/navigation";

import { getAiscribeIsAdmin } from "@/app/aiscribe/_lib/access";
import { DoctorsNoteEditor } from "@/app/aiscribe/_components/doctors-note-editor";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

export default async function WorkspaceEditorPage(
	props: PageProps<"/aiscribe/editor/[slug]">,
) {
	// Brief-Baukasten is admin-flagged while it is iterated on.
	const isAdmin = await getAiscribeIsAdmin();
	if (!isAdmin) {
		notFound();
	}

	const { slug } = await props.params;
	const queryClient = getQueryClient();
	const workspace = await queryClient
		.fetchQuery(
			orpc.scribeWorkspaces.getBySlug.queryOptions({ input: { slug } }),
		)
		.catch(() => null);

	if (!workspace) {
		notFound();
	}

	return (
		<DoctorsNoteEditor
			description={workspace.description}
			sections={workspace.sections}
			title={workspace.title}
		/>
	);
}
