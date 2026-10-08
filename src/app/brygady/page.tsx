import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sortBrigades, getDayLabel, getDayBadgeClass } from "@/lib/brigades";

export const dynamic = "force-dynamic";

export default async function BrigadesPage({
  searchParams,
}: {
  searchParams: Promise<{ lineId?: string; carrier?: string }>;
}) {
  const { lineId, carrier: carrierFilter } = await searchParams;
  const session = await getServerSession(authOptions);

  const isDriver = session?.user?.role === "KIEROWCA";
  const driverCarrier = isDriver ? session?.user?.carrier : null;
  const effectiveCarrier = driverCarrier || carrierFilter;

  const [allLines, rawSchedules] = await Promise.all([
    prisma.line.findMany({
      where: effectiveCarrier ? { OR: [{ carrier: effectiveCarrier }, { carrier: null }] } : undefined,
      orderBy: { number: "asc" },
    }),
    prisma.brigadeSchedule.findMany({
      where: lineId ? { lineId } : undefined,
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
  ]);

  const filteredRawSchedules = rawSchedules.filter((s) => {
    if (!effectiveCarrier) return true;
    if (s.carrier) return s.carrier === effectiveCarrier;
    if (s.line?.carrier) return s.line.carrier === effectiveCarrier;
    // Jeśli ani linia ani brygada nie ma przewoźnika, dopuszczamy tylko jeśli nie ma restrykcji
    return !s.carrier && !s.line?.carrier;
  });

  const schedules = sortBrigades(filteredRawSchedules);
  const lines = allLines;
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
                  <th className="py-3.5 px-4">Godzina Wyjazdu / Zjazdu</th>
                  <th className="py-3.5 px-4">Przystanki (Pierwszy &rarr; Ostatni)</th>
                  <th className="py-3.5 px-4">Miejsce Wyjazdu &rarr; Zjazdu</th>
                  <th className="py-3.5 px-4">Przesiadki / Podmiany</th>
                  <th className="py-3.5 px-4">Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {schedules.map((item) => {
                  const carrierName = item.carrier || item.line?.carrier || "VMPK";
                  const startLoc = item.startLocation || "";
                  const endLoc = item.endLocation || "";
                  const wyjazdFormatted = !startLoc
                    ? "—"
                    : startLoc.includes(" - ")
                      ? startLoc
                      : startLoc.includes(" / ")
                        ? startLoc.replace(" / ", " - ")
                        : `Zajezdnia ${carrierName} - ${startLoc}`;
                  const zjazdFormatted = !endLoc
                    ? "—"
                    : endLoc.includes(" - ")
                      ? endLoc
                      : endLoc.includes(" / ")
                        ? endLoc.replace(" / ", " - ")
                        : `${endLoc} - Zajezdnia ${carrierName}`;

                  return (
                    <tr key={item.id} className="hover:bg-slate-750 transition-colors">
                      <td className="py-3.5 px-4 font-black text-amber-400 text-base whitespace-nowrap">
                        <span>Linia {item.line?.number || "—"}</span>
                        {(item.carrier || item.line?.carrier) && (
                          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                            (item.carrier || item.line?.carrier) === "VBP" ? "bg-blue-900/60 text-blue-300 border-blue-600/40" : "bg-red-900/60 text-amber-300 border-red-600/40"
                          }`}>
                            {item.carrier || item.line?.carrier}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.brigadeNumber}</span>
                          <span
                            className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border ${getDayBadgeClass(
                              item.brigadeNumber,
                              item.notes
                            )}`}
                          >
                            {getDayLabel(item.brigadeNumber, item.notes)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="text-slate-400">Wyjazd:</span>{" "}
                            <b className="font-mono text-emerald-300">{item.startTime || "—"}</b>
                          </div>
                          <div>
                            <span className="text-slate-400">Zjazd:</span>{" "}
                            <b className="font-mono text-amber-300">{item.endTime || "—"}</b>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-200">
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-400">1. przystanek:</span>{" "}
                            <span className="font-mono text-cyan-300 font-semibold">{item.firstStopDeparture || "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Ost. przystanek:</span>{" "}
                            <span className="font-mono text-cyan-300 font-semibold">{item.lastStopArrival || "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200">
                        <div className="text-xs font-semibold">
                          <span className="text-slate-400 font-normal">Wyjazd:</span> {wyjazdFormatted}
                        </div>
                        <div className="text-xs font-semibold mt-0.5">
                          <span className="text-slate-400 font-normal">Zjazd:</span> {zjazdFormatted}
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
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
