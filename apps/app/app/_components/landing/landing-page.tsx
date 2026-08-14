import { Features } from "./features";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { Pricing } from "./pricing";

interface LandingPageProps {
	isLoggedIn: boolean;
}

export const LandingPage = ({ isLoggedIn }: LandingPageProps) => (
	<div className="h-full w-full self-start">
		<main className="w-full overflow-x-clip" key="landing-content">
			<Hero isLoggedIn={isLoggedIn} />
			<Features />
			<Pricing isLoggedIn={isLoggedIn} />
		</main>
		<Footer />
	</div>
);
