type DocumentDetailAction = { href: string; kind: "edit" } | { href: string; kind: "fork" };

export const getDocumentDetailAction = ({
	documentId,
	isAuthor,
	isLoggedIn,
}: {
	documentId: string;
	isAuthor: boolean;
	isLoggedIn: boolean;
}): DocumentDetailAction | null => {
	if (!isLoggedIn) {
		return null;
	}
	if (isAuthor) {
		return { href: `/documents/${documentId}/edit`, kind: "edit" };
	}
	return { href: `/documents/create?fork=${documentId}`, kind: "fork" };
};
