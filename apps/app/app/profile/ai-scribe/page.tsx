import { PersonalContextCard } from "../_components/personal-context-card";
import { UserAiTextsCard } from "../_components/user-ai-texts-card";
import { UserBriefWorkspacesCard } from "../_components/user-brief-workspaces-card";

export default function ProfileAiScribePage() {
	return (
		<div className="space-y-6">
			<div className="space-y-1">
				<h2 className="font-semibold text-solarized-base00 text-2xl">AI-Scribe</h2>
				<p className="text-sm text-solarized-base01">
					Persönlicher Kontext und AI Vorlagen für wiederkehrende Dokumentationsabläufe.
				</p>
			</div>
			<div className="space-y-6">
				<PersonalContextCard />
				<UserAiTextsCard />
				<UserBriefWorkspacesCard />
			</div>
		</div>
	);
}
