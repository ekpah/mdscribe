import type { Metadata } from "next";

import { MobileUploadPage } from "./mobile-upload-page";

export const metadata: Metadata = {
	description: "Ein Foto an mdScribe übertragen.",
	title: "Foto übertragen | mdScribe",
};

export default function Page() {
	return <MobileUploadPage />;
}
