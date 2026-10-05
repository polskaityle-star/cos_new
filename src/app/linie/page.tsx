import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LinesPage() {
  const lines = await prisma.line.findMany({
    orderBy: { number: 'asc' }
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Obsługiwane Linie</h1>
          <p className="text-slate-300">
            Lista linii komunikacyjnych obsługiwanych przez przewoźników VZTM Kielce.
          </p>
        </div>
        <Link
          href="/brygady"
          className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors self-start md:self-auto"
        >
          📋 Przejdź do Wykazu Brygad &rarr;
        </Link>
      </div>

      {lines.length === 0 ? (
        <div className="bg-slate-800 p-6 rounded-lg text-center text-slate-400">
          Brak zdefiniowanych linii w systemie.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lines.map((line) => (
            <div key={line.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-500 transition-colors flex flex-col justify-between">
              <div>
                <div className="bg-slate-700 p-4 border-b border-slate-600 flex items-center justify-between">
                  <span className="text-2xl font-black text-white">Linia {line.number}</span>
                  {line.brigades && (
                    <span className="text-xs bg-slate-800 px-2.5 py-1 rounded text-amber-300 font-mono border border-slate-600">
                      Brygady: {line.brigades}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {line.directions && (
                    <div>
                      <span className="text-slate-400 text-xs block mb-1">Kierunki / Trasa:</span>
                      <p className="text-slate-100 font-medium text-sm">{line.directions}</p>
                    </div>
                  )}
                  {line.startStop && line.endStop ? (
                    <div className="text-xs text-slate-400 pt-1 border-t border-slate-700 flex justify-between">
                      <span>Start: <strong className="text-slate-200">{line.startStop}</strong></span>
                      <span>Koniec: <strong className="text-slate-200">{line.endStop}</strong></span>
                    </div>
                  ) : null}
                  {!line.directions && !line.startStop && (
                    <p className="text-slate-400 text-sm italic">Trasa wg aktualnego rozkładu jazdy.</p>
                  )}
                </div>
              </div>
              <div className="p-4 pt-0">
                <Link
                  href={`/brygady?lineId=${line.id}`}
                  className="block text-center text-xs text-amber-400 hover:text-amber-300 hover:underline pt-2 border-t border-slate-700/60"
                >
                  Zobacz brygady linii {line.number} &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
