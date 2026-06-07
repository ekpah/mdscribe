import { AudioLines } from "lucide-react";
import type { Metadata } from "next";
import { AudioPlaygroundClient } from "./_components/audio-playground-client";

export const metadata: Metadata = {
	description: "Audioaufnahme und Transkription mit auswählbarem Modell testen",
	title: "Audio-Playground",
};

export default function AudioPlaygroundPage() {
	return (
		<div className="p-4 sm:p-6">
			<div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-solarized-blue/10 sm:h-12 sm:w-12">
							<AudioLines className="h-5 w-5 text-solarized-blue sm:h-6 sm:w-6" />
						</div>
						<div>
							<h1 className="font-bold text-xl text-solarized-base00 sm:text-2xl md:text-3xl">
								Audio-Playground
							</h1>
							<p className="text-sm text-solarized-base01 sm:text-base">
								Audio aufnehmen, Modell wechseln und die Transkription direkt prüfen
							</p>
						</div>
					</div>
				</div>
				<AudioPlaygroundClient />
			</div>
		</div>
	);
}
