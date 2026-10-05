import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BrigadesPage({
  searchParams,
}: {
  searchParams: Promise<{ lineId?: string }>;
}) {
  const { lineId } = await searchParams;

  const [lines, schedules] = await Promise.all([
    prisma.line.findMany({ orderBy: { number: "asc" } }),
    prisma.brigadeSchedule.findMany({
      where: lineId ? { lineId } : undefined,
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
  ]);

  const activeLine = lines.find((l) => l.id === lineId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-amber-400">📋 Wykaz Brygad i Służb</h1>
          <p className="text-slate-300 mt-1">
            Szczegółowy harmonogram odjazdów, zjazdów oraz wyznaczonych punktów przesiadek dla kierowców.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/linie"
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            &larr; Powrót do Linii
          </Link>
        </div>
      </div>

      {/* Filtrowanie według linii */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold mr-2">Filtruj linię:</span>
        <Link
          href="/brygady"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
            !lineId ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Wszystkie linie
        </Link>
        {lines.map((l) => (
          <Link
            key={l.id}
            href={`/brygady?lineId=${l.id}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              lineId === l.id ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Linia {l.number}
          </Link>
        ))}
      </div>

      {/* Wykaz harmonogramu */}
      {schedules.length === 0 ? (
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center text-slate-400">
          <p className="text-lg">Brak wpisów w wykazie brygad {activeLine ? `dla linii ${activeLine.number}` : ""}.</p>
          <p className="text-sm text-slate-500 mt-2">Zarząd może dodać brygady w Panelu Zarządu.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs text-slate-300 uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3.5 px-4">Linia</th>
                  <th className="py-3.5 px-4">Brygada</th>
                  <th className="py-3.5 px-4">Godziny pracy</th>
                  <th className="py-3.5 px-4">Wyjazd &rarr; Zjazd</th>
                  <th className="py-3.5 px-4">Przesiadki / Podmiany</th>
                  <th className="py-3.5 px-4">Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {schedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-750 transition-colors">
                    <td className="py-3.5 px-4 font-black text-amber-400 text-base">
                      {item.line.number}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {item.brigadeNumber}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="bg-slate-900 border border-slate-600 px-2 py-1 rounded font-mono text-xs text-emerald-300">
                        {item.startTime} &ndash; {item.endTime}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-200">
                      <div className="text-xs">
                        <span className="text-slate-400">Start:</span> {item.startLocation}
                      </div>
                      <div className="text-xs mt-0.5">
                        <span className="text-slate-400">Koniec:</span> {item.endLocation}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.driverChanges ? (
                        <span className="bg-blue-900/40 border border-blue-600/40 text-blue-200 px-2.5 py-1 rounded text-xs block">
                          🔄 {item.driverChanges}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Bez przesiadki na trasie</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {item.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
