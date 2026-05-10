import dynamic from "next/dynamic";
import Features from "./features";
import Footer from "./footer";
import HeroSkeleton from "./skeletons/hero-skeleton";
import PricingSkeleton from "./skeletons/pricing-skeleton";

const Hero = dynamic(() => import("./hero"), {
	loading: () => <HeroSkeleton />,
});

const Pricing = dynamic(() => import("./pricing"), {
	loading: () => <PricingSkeleton />,
});

interface LandingPageProps {
	isLoggedIn: boolean;
}

// PERF: Receive isLoggedIn from server to eliminate redundant client auth checks
export default function LandingPage({ isLoggedIn }: LandingPageProps) {
	return (
		<div className="h-full w-full">
			<main
				className="flex flex-col gap-12 overflow-x-hidden pb-12 md:gap-20 lg:gap-24"
				key="landing-content"
			>
				<Hero isLoggedIn={isLoggedIn} />
				<Features />
				<Pricing isLoggedIn={isLoggedIn} />
			</main>

			<Footer />
		</div>
	);
}
