export default function VMPKPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-[#E31837] to-red-900 rounded-2xl p-12 text-white shadow-xl border border-red-700">
        <h1 className="text-5xl font-black mb-4 text-[#FFC627] drop-shadow-md">VMPK Kielce</h1>
        <p className="text-xl max-w-3xl leading-relaxed">
          Wirtualne Miejskie Przedsiębiorstwo Komunikacyjne w Kielcach. 
          Rozpoznawalni z daleka dzięki naszym charakterystycznym, czerwono-żółtym barwom. 
          Jesteśmy głównym operatorem komunikacyjnym w wirtualnych Kielcach na platformie OMSI 2.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-[#E31837] mb-4">O nas</h2>
          <p className="text-slate-300">
            Tradycja i doświadczenie to nasze drugie imię. Obsługujemy najważniejsze i najbardziej obciążone 
            linie w mieście. Nasi kierowcy cenią sobie punktualność i profesjonalizm.
          </p>
        </div>
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold text-[#FFC627] mb-4">Nasza Flota</h2>
          <p className="text-slate-300">
            Posiadamy zróżnicowany tabor miejski, od standardowych 12-metrowych autobusów, 
            aż po wielkopojemne przegubowce.
          </p>
        </div>
      </div>
    </div>
  );
}
