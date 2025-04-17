import AIFeatures from './AIFeatures';
import Features from './Features';
import Footer from './Footer';
import Hero from './Hero';
import Pricing from './Pricing';

export default function LandingPage() {
  return (
    <div className="h-full w-full">
      <div key="landing-content" className="pb-12">
        <Hero />
        <Features />
        <AIFeatures />
        <Pricing />
      </div>

      <Footer />
    </div>
  );
}
