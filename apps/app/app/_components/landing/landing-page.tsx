import { Features } from "./features";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { Pricing } from "./pricing";

interface LandingPageProps {
	isLoggedIn: boolean;
	subscriptionsEnabled: boolean;
}

export const LandingPage = ({ isLoggedIn, subscriptionsEnabled }: LandingPageProps) => (
	<div className="h-full w-full max-w-full self-start overflow-x-clip">
		<main className="w-full" key="landing-content">
			<Hero isLoggedIn={isLoggedIn} />
			<Features />
			<Pricing isLoggedIn={isLoggedIn} subscriptionsEnabled={subscriptionsEnabled} />
		</main>
		<Footer />
	</div>
);
