import SmartCompletion from '@/public/landing/SmartCompletion';
import TemplateLibrary from '@/public/landing/TemplateLibrary';

export default function Features() {
  return (
    <section className="py-8">
      <div className="container m-8 mx-auto max-w-5xl">
        <h1 className="my-2 w-full text-center font-bold text-5xl leading-tight">
          Features
        </h1>
        <div className="mb-4 w-full">
          <div className="gradient mx-auto my-0 h-1 w-64 rounded-t py-0 opacity-25" />
        </div>
        <div className="flex flex-wrap">
          <div className="w-5/6 p-6 sm:w-1/2">
            <h3 className="mb-3 font-bold text-3xl leading-none">
              Baustein-Bibliothek
            </h3>
            <p className="mb-8 text-xl">
              Eine Sammlung von Textbausteinen ist verfügbar, damit du direkt
              loslegen kannst.
            </p>
          </div>
          <div className="w-full p-6 sm:w-1/2">
            <TemplateLibrary />
          </div>
        </div>
        <div className="flex flex-col-reverse flex-wrap sm:flex-row">
          <div className="mt-6 w-full p-6 sm:w-1/2">
            <SmartCompletion />
          </div>
          <div className="mt-6 w-full p-6 sm:w-1/2">
            <div className="align-middle">
              <h3 className="mb-3 font-bold text-3xl leading-none">
                Schlaue Anpassung
              </h3>
              <p className="mb-8 text-xl">
                Ohne viel manuelles Schreiben lassen sich die Textbausteine an
                die üblichsten Situation anpassen, damit du schnell zur fertigen
                Epikrise kommst.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
