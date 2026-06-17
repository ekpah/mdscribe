import { notFound } from "next/navigation";

import { DoctorsNoteEditor } from "@/app/aiscribe/_components/doctors-note-editor";
import { getQueryClient } from "@/lib/get-query-client";
import { orpc } from "@/lib/orpc";

export default async function WorkspaceUserEditorPage(
	props: PageProps<"/aiscribe/workspace/u/[username]/[slug]">,
) {
	const { slug, username } = await props.params;
	const queryClient = getQueryClient();
	const workspace = await queryClient
		.fetchQuery(
			orpc.scribeWorkspaces.getByUsernameSlug.queryOptions({
				input: { slug, username },
			}),
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
