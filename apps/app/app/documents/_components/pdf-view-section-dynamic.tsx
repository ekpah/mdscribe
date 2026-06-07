"use client";

import dynamic from "next/dynamic";

export const PDFViewSection = dynamic(
	async () => {
		const viewModule = await import("@/app/documents/_components/pdf-view-section");
		return viewModule.PDFViewSection;
	},
	{
		ssr: false,
	},
);
