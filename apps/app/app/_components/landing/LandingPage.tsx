import dynamic from "next/dynamic";
import { Suspense } from "react";
import Features from "./Features";
import Footer from "./Footer";
import AIFeaturesSkeleton from "./skeletons/AIFeaturesSkeleton";
import HeroSkeleton from "./skeletons/HeroSkeleton";
import PricingSkeleton from "./skeletons/PricingSkeleton";

const Hero = dynamic(() => import("./Hero"), {
	loading: () => <HeroSkeleton />,
});

const AIFeatures = dynamic(() => import("./AIFeatures"), {
	loading: () => <AIFeaturesSkeleton />,
});

const Pricing = dynamic(() => import("./Pricing"), {
	loading: () => <PricingSkeleton />,
});

export default function LandingPage() {
	return (
		<div className="h-full w-full">
			<main
				className="flex flex-col gap-12 overflow-x-hidden pb-12 md:gap-20 lg:gap-24"
				key="landing-content"
			>
				<Hero />
				<Features />
				<AIFeatures />
				<Pricing />
			</main>

			<Footer />
		</div>
	);
}
