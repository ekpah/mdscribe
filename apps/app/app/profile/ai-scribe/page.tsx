import { UserBriefWorkspacesCard } from "../_components/user-brief-workspaces-card";
import { UserAiTextsCard } from "../_components/user-ai-texts-card";

export default function ProfileAiScribePage() {
	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h2 className="font-semibold text-solarized-base00 text-2xl">AI-Scribe</h2>
				<p className="text-sm text-solarized-base01">
					Persönliche AI Vorlagen für wiederkehrende Dokumentationsabläufe.
				</p>
			</div>
			<div className="space-y-6">
				<UserAiTextsCard />
				<UserBriefWorkspacesCard />
			</div>
		</div>
	);
}
