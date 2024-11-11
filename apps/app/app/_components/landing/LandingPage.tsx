import Features from "./Features";
import Hero from "./Hero";
const date = new Date().getFullYear();

export default function LandingPage() {
  return (
    <div className="w-full h-full">
      <div key="landing-content" className="h-250">
        <Hero />
      </div>

      <footer className="fixed bottom-0 h-8 z-30 w-full items-center border-t bg-background p-2 text-center">
        <div className="self-center text-xs">
          <a href="/">
            Copyright ©{date}- All right reserved by Dr. Nils Hapke
          </a>
        </div>
      </footer>
    </div>
  );
}
