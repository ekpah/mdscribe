import Features from "./Features";
import Hero from "./Hero";
const date = new Date().getFullYear();

export default function LandingPage() {
  return (
    <div className="w-full">
      <Hero />

      <Features />
      <footer className="bottom-0 z-30 items-center border-t bg-background p-2 text-center">
        <div className="self-center text-xs">
          <a href="/">
            Copyright ©{date}- All right reserved by Dr. Nils Hapke
          </a>
        </div>
      </footer>
    </div>
  );
}
