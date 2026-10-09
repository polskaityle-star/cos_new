import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-12">
      <div className="text-center space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3.5 py-1 rounded-full text-xs font-mono font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Wersja systemu:</span>
          <span className="underline font-extrabold">v0.4.0.0</span>
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight">Witaj w VZTM Kielce</h1>
        <p className="text-lg text-slate-300">
          Wirtualny Zarząd Transportu Miejskiego dla gry OMSI 2. Zarządzamy komunikacją miejską w wirtualnych Kielcach,
          udostępniając trasy i rozkłady jazdy dla dwóch niezależnych przewoźników: VMPK oraz VBP Tour Regio.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* VMPK Card */}
        <Link href="/vmpk" className="group relative overflow-hidden rounded-xl border-2 border-[#E31837] bg-slate-800 transition-transform hover:scale-105 hover:shadow-[0_0_20px_rgba(227,24,55,0.4)]">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#E31837] to-[#FFC627]"></div>
          <div className="p-8 space-y-4">
            <h2 className="text-3xl font-bold text-[#FFC627]">VMPK Kielce</h2>
            <p className="text-slate-300">
              Wirtualne Miejskie Przedsiębiorstwo Komunikacyjne w Kielcach. Czerwono-żółte barwy, tradycja i niezawodność. 
              Trzon kieleckiej komunikacji miejskiej.
            </p>
            <span className="inline-block mt-4 text-[#E31837] font-semibold group-hover:underline">Odwiedź stronę przewoźnika &rarr;</span>
          </div>
        </Link>

        {/* VBP Card */}
        <Link href="/vbp" className="group relative overflow-hidden rounded-xl border-2 border-[#005A9C] bg-slate-800 transition-transform hover:scale-105 hover:shadow-[0_0_20px_rgba(0,90,156,0.4)]">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#005A9C] to-white"></div>
          <div className="p-8 space-y-4">
            <h2 className="text-3xl font-bold text-white">VBP Tour Regio</h2>
            <p className="text-slate-300">
              VBP Tour Regio Kielce. Niebiesko-białe barwy. Nowoczesność i komfort na trasach miejskich i podmiejskich.
              Twój solidny partner w podróży.
            </p>
            <span className="inline-block mt-4 text-[#005A9C] font-semibold group-hover:underline">Odwiedź stronę przewoźnika &rarr;</span>
          </div>
        </Link>
      </div>

      <div className="text-center pt-8 border-t border-slate-700 w-full max-w-2xl">
        <h3 className="text-2xl font-bold mb-4">Dołącz do nas!</h3>
        <p className="text-slate-300 mb-6">
          Złóż wniosek rekrutacyjny, wybierz swojego przewoźnika i rozpocznij karierę wirtualnego kierowcy autobusu.
        </p>
        <Link href="/register" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors text-lg">
          Złóż Wniosek (Rejestracja)
        </Link>
      </div>
    </div>
  );
}
