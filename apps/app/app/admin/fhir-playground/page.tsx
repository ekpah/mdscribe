import { Waypoints } from "lucide-react";
import type { Metadata } from "next";

import { FhirPlaygroundClient } from "./fhir-playground-client";

export const metadata: Metadata = {
	description: "FHIR JSON mit einem Markdoc Info-Tag auswerten und rendern",
	title: "FHIR-Playground",
};

export default function FhirPlaygroundPage() {
	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
						<Waypoints className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
					</div>
					<div>
						<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
							FHIR-Playground
						</h1>
						<p className="text-sm text-solarized-base01 sm:text-base">
							FHIR JSON laden und einen source=&quot;fhir://...&quot; Info-Tag ausprobieren
						</p>
					</div>
				</div>
				<FhirPlaygroundClient />
			</div>
		</div>
	);
}
