"use client";

import dynamic from "next/dynamic";

export const PDFViewSection = dynamic(
	async () => (await import("@/app/documents/_components/pdf-view-section")).PDFViewSection,
	{
		ssr: false,
	},
);
