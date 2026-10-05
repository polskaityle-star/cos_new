import { prisma } from "@/lib/prisma";

export default async function LinesPage() {
  const lines = await prisma.line.findMany({
    orderBy: { number: 'asc' }
  });

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold mb-6">Obsługiwane Linie</h1>
      <p className="text-slate-300">
        Poniżej znajduje się lista linii obsługiwanych przez przewoźników VZTM Kielce w ramach mapy (wzorowane na danych Czynaczas/Kielce).
      </p>

      {lines.length === 0 ? (
        <div className="bg-slate-800 p-6 rounded-lg text-center text-slate-400">
          Brak zdefiniowanych linii w systemie.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lines.map((line) => (
            <div key={line.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-500 transition-colors">
              <div className="bg-slate-700 p-4 border-b border-slate-600 flex items-center justify-between">
                <span className="text-2xl font-black text-white">Linia {line.number}</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Przystanek początkowy:</span>
                  <span className="font-semibold text-right">{line.startStop}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Przystanek końcowy:</span>
                  <span className="font-semibold text-right">{line.endStop}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
