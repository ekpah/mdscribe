import AIFeatures from './AIFeatures';
import Features from './Features';
import Footer from './Footer';
import Hero from './Hero';
import Pricing from './Pricing';

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
