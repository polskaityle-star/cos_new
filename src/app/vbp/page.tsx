import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VBP Tour Regio – VZTM Kielce",
  description: "VBP Tour Regio Kielce – alternatywny przewoźnik w OMSI 2. Niebiesko-białe barwy, tabor najnowszej generacji i komfort na trasach miejskich oraz podmiejskich.",
};

export default function VBPPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-[#005A9C] to-blue-900 rounded-2xl p-12 text-white shadow-xl border border-blue-700">
        <h1 className="text-5xl font-black mb-4 drop-shadow-md">VBP Tour Regio</h1>
        <p className="text-xl max-w-3xl leading-relaxed text-blue-50">
          VBP Tour Regio Kielce to nowoczesny przewoźnik w wirtualnych Kielcach dla OMSI 2. 
          Charakteryzujemy się eleganckimi, niebiesko-białymi barwami. 
          Stawiamy na wysoki standard i komfort pasażerów.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-[#005A9C] mb-4">O nas</h2>
          <p className="text-slate-300">
            Jako alternatywny przewoźnik wprowadzamy powiew świeżości na kieleckie ulice.
            Obsługujemy wybrane linie miejskie oraz podmiejskie, zapewniając sprawną komunikację
            dla mieszkańców regionu.
          </p>
        </div>
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-4">Nasza flota</h2>
          <p className="text-slate-300">
            Inwestujemy w tabor najnowszej generacji. Nasze pojazdy to komfortowe, klimatyzowane autobusy
            zapewniające bezpieczną podróż.
          </p>
        </div>
      </div>
    </div>
  );
}
