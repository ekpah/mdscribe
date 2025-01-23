import Hero from './Hero';
const date = new Date().getFullYear();

export default function LandingPage() {
  return (
    <div className="h-full w-full">
      <div key="landing-content" className="h-250">
        <Hero />
      </div>

      <footer className="fixed bottom-0 z-30 h-8 w-full items-center border-t bg-background p-2 text-center">
        <div className="self-center text-xs">
          <a href="/legal">
            Copyright ©{date}- All right reserved by Dr. Nils Hapke
          </a>
        </div>
      </footer>
    </div>
  );
}
