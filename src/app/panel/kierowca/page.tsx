import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DriverPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "KIEROWCA" && session.user.role !== "ZARZAD") {
    redirect("/");
  }

  const [duties, driverRequests, vehicleDefects, allVehicles, allLines, brigadeSchedules] = await Promise.all([
    prisma.duty.findMany({
      where: { userId: session.user.id },
      include: { line: true, vehicle: true, report: true },
      orderBy: { date: "desc" },
    }),
    prisma.driverRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicleDefect.findMany({
      where: { userId: session.user.id },
      include: { vehicle: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.findMany({
      orderBy: { fleetNumber: "asc" },
    }),
    prisma.line.findMany({
      orderBy: { number: "asc" },
    }),
    prisma.brigadeSchedule.findMany({
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
  ]);

  const scheduledDuties = duties.filter((d) => d.status === "SCHEDULED");
  const completedDuties = duties.filter((d) => d.status === "COMPLETED");
  const acceptedReports = duties.filter((d) => d.report?.status === "ACCEPTED");
  const totalKm = duties.reduce((acc, d) => {
    if (d.report && d.report.endMileage > d.report.startMileage) {
      return acc + (d.report.endMileage - d.report.startMileage);
    }
    return acc;
  }, 0);

  return (
    <div className="space-y-10">
      {/* Nagłówek panelu */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-white">Panel Kierowcy</h1>
          <p className="text-slate-400 mt-1">
            Zalogowany jako: <span className="font-semibold text-emerald-400">{session.user.username}</span> ({session.user.carrier || "Brak przydziału"})
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Link
            href="/brygady"
            className="bg-amber-700/80 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-amber-600/60 shadow"
          >
            <span>📋 Wykaz Brygad</span>
          </Link>
          <Link
            href="/"
            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-600"
          >
            <span>🌐 Strona publiczna</span>
          </Link>
          {session.user.role === "ZARZAD" && (
            <Link
              href="/panel/zarzad"
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-3.5 py-2 rounded-lg transition-colors text-xs"
            >
              Panel Zarządu &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Podsumowanie postępów kierowcy */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Zrealizowane służby</span>
          <div className="text-2xl font-black text-emerald-400 mt-2">{completedDuties.length} / {duties.length}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Przejechany dystans</span>
          <div className="text-2xl font-black text-amber-400 mt-2">{totalKm.toLocaleString()} km</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Zatwierdzone raporty</span>
          <div className="text-2xl font-black text-blue-400 mt-2">{acceptedReports.length}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Złożone wnioski i awarie</span>
          <div className="text-2xl font-black text-purple-400 mt-2">{driverRequests.length + vehicleDefects.length}</div>
        </div>
      </div>

      {/* Twoje Służby (Grafik) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <span>📅 Twoje Służby (Grafik)</span>
        </h2>
        {duties.length === 0 ? (
          <p className="text-slate-400">Nie masz obecnie przypisanych żadnych służb.</p>
        ) : (
          <div className="space-y-4">
            {duties.map((duty) => (
              <div
                key={duty.id}
                className="bg-slate-900 border border-slate-700 p-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-black text-white">Linia {duty.line.number}</span>
                    {duty.brigade && (
                      <span className="bg-amber-900/50 text-amber-300 border border-amber-600/40 text-xs px-2.5 py-1 rounded font-mono font-bold">
                        Brygada: {duty.brigade}
                      </span>
                    )}
                    {duty.vehicle && (
                      <span className="bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1.5">
                        🚌 #{duty.vehicle.fleetNumber} ({duty.vehicle.model})
                        <span className="text-cyan-400 font-mono text-[11px] bg-cyan-900/50 px-1.5 py-0.5 rounded">
                          {duty.vehicle.mileage} km
                        </span>
                      </span>
                    )}
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        duty.status === "SCHEDULED"
                          ? "bg-blue-900/60 text-blue-300 border border-blue-600/40"
                          : duty.status === "COMPLETED"
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-600/40"
                          : "bg-gray-800 text-gray-400 border border-gray-600/40"
                      }`}
                    >
                      {duty.status === "SCHEDULED" ? "Zaplanowana" : duty.status === "COMPLETED" ? "Zrealizowana" : "Anulowana"}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    Trasa: {duty.line.directions || (duty.line.startStop ? `${duty.line.startStop} → ${duty.line.endStop}` : "Zgodnie z rozkładem")}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Data służby: {new Date(duty.date).toLocaleDateString()}
                  </div>

                  {/* Szczegóły przypisanej brygady */}
                  {duty.brigade && (() => {
                    const matched = brigadeSchedules.find(
                      (b) => b.lineId === duty.lineId && (duty.brigade === b.brigadeNumber || duty.brigade?.includes(b.brigadeNumber) || b.brigadeNumber.includes(duty.brigade!))
                    );
                    if (!matched) return null;
                    return (
                      <div className="mt-2.5 text-xs bg-slate-950/70 p-2.5 rounded border border-slate-800 text-slate-300 space-y-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>⏰ Godziny: <b className="text-amber-300 font-mono">{matched.startTime} - {matched.endTime}</b></span>
                          <span>📍 Wyjazd: <b className="text-white">{matched.startLocation}</b></span>
                          <span>🏁 Zjazd: <b className="text-white">{matched.endLocation}</b></span>
                        </div>
                        {matched.driverChanges && (
                          <div className="text-[11px] text-slate-400">
                            🔄 Przesiadki: <span className="text-slate-300">{matched.driverChanges}</span>
                          </div>
                        )}
                        {matched.notes && (
                          <div className="text-[11px] text-amber-400/90">
                            ℹ️ Uwagi: <span>{matched.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {duty.status === "SCHEDULED" && (
                    <>
                      <a
                        href={`/panel/kierowca/raport?dutyId=${duty.id}`}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                      >
                        Złóż raport
                      </a>
                    </>
                  )}
                  {duty.status === "COMPLETED" && (
                    <div className="text-right">
                      <span className="bg-slate-800 px-3 py-1 rounded text-xs text-slate-300 block mb-1">
                        Status raportu: {duty.report?.status || "Brak"}
                      </span>
                      <span className="text-emerald-400 font-bold text-xs">Raport wysłany</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 📋 Wykaz Brygad (Harmonogram dla Kierowców) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-amber-400">
              <span>📋 Wykaz Brygad i Harmonogram Odjazdów ({brigadeSchedules.length})</span>
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Sprawdź godziny wyjazdów, zjazdów do zajezdni oraz zaplanowane punkty przesiadek dla wszystkich linii i brygad.
            </p>
          </div>
          <Link
            href="/brygady"
            className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-colors self-start md:self-auto"
          >
            <span>Pełny wykaz z filtrowaniem linii &rarr;</span>
          </Link>
        </div>

        {brigadeSchedules.length === 0 ? (
          <p className="text-slate-400 text-sm">Brak zdefiniowanych brygad w systemie.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/90 text-xs text-slate-300 uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Linia</th>
                  <th className="py-3 px-4">Brygada</th>
                  <th className="py-3 px-4">Godziny</th>
                  <th className="py-3 px-4">Trasa / Wyjazd ➔ Zjazd</th>
                  <th className="py-3 px-4">Przesiadki kierowców</th>
                  <th className="py-3 px-4">Uwagi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 bg-slate-900/40">
                {brigadeSchedules.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      Linia {b.line.number}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="bg-amber-900/50 text-amber-300 border border-amber-600/40 text-xs px-2 py-0.5 rounded font-mono font-bold">
                        {b.brigadeNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold whitespace-nowrap text-xs">
                      {b.startTime} - {b.endTime}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div><b>Start:</b> {b.startLocation}</div>
                      <div className="text-slate-400"><b>Zjazd:</b> {b.endLocation}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      {b.driverChanges || <span className="text-slate-500 italic">Brak przesiadek</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {b.notes || <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Wnioski Kierowcy (Urlop, Dodatkowa służba, Anulowanie) */}
      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-amber-400">
            <span>📝 Złóż wniosek do Zarządu</span>
          </h2>
          <form action="/api/panel/kierowca/wniosek" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Typ wniosku *</label>
              <select
                name="type"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
              >
                <option value="URLOP">🏖 Wniosek o urlop</option>
                <option value="DODATKOWA_SLUZBA">➕ Wniosek o dodatkową służbę</option>
                <option value="ANULOWANIE_SLUZBY">❌ Prośba o anulowanie / rezygnację ze służby</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Data początkowa / data służby</label>
                <input
                  type="date"
                  name="dateStart"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Data końcowa (dla urlopu)</label>
                <input
                  type="date"
                  name="dateEnd"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
                />
              </div>
            </div>

            {scheduledDuties.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Wybierz służbę do anulowania (jeśli dotyczy)
                </label>
                <select
                  name="dutyId"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
                >
                  <option value="">-- Nie dotyczy / wybierz jeśli anulujesz --</option>
                  {scheduledDuties.map((d) => (
                    <option key={d.id} value={d.id}>
                      Linia {d.line.number} {d.brigade ? `[${d.brigade}]` : ""} (Dnia: {new Date(d.date).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Szczegóły / preferowana linia (opcjonalnie)
              </label>
              <input
                type="text"
                name="details"
                placeholder="np. Preferowana linia 34, zmiana popołudniowa"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Powód / Uzasadnienie *</label>
              <textarea
                name="reason"
                required
                rows={3}
                placeholder="Wyjaśnij powód składania wniosku..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg shadow transition-colors"
            >
              Wyślij wniosek do Zarządu
            </button>
          </form>
        </section>

        {/* Zgłaszanie Awarii Pojazdu */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-rose-400">
            <span>🚨 Zgłoś usterkę / zdarzenie pojazdu</span>
          </h2>
          <form action="/api/panel/kierowca/usterka" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Pojazd z taboru *</label>
              <select
                name="vehicleId"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100"
              >
                <option value="">-- Wybierz pojazd --</option>
                {allVehicles.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    {veh.fleetNumber} - {veh.model} [{veh.carrier}] ({veh.registration})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tytuł usterki / Co się stało? *</label>
              <input
                type="text"
                name="title"
                required
                placeholder="np. Awaria drzwi II, Stłuczka na pętli, Brak hamulców"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Dokładny opis zdarzenia / uszkodzeń *</label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder="Opisz dokładnie kiedy i co się stało oraz jakie są uszkodzenia pojazdu..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100 resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-lg shadow transition-colors"
            >
              Zgłoś usterkę do dyspozytorni
            </button>
          </form>
        </section>
      </div>

      {/* Twoje Zgłoszenia i Wnioski (Historia) */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Status wniosków kierowcy */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h3 className="text-xl font-bold mb-4 text-slate-200">Twoje wnioski</h3>
          {driverRequests.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak złożonych wniosków.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {driverRequests.map((req) => (
                <div key={req.id} className="bg-slate-900 border border-slate-700 p-3.5 rounded-lg text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-amber-300">
                      {req.type === "URLOP"
                        ? "🏖 Urlop"
                        : req.type === "DODATKOWA_SLUZBA"
                        ? "➕ Dodatkowa służba"
                        : "❌ Anulowanie służby"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        req.status === "PENDING"
                          ? "bg-yellow-900/60 text-yellow-300"
                          : req.status === "ACCEPTED"
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-red-900/60 text-red-300"
                      }`}
                    >
                      {req.status === "PENDING" ? "Oczekuje" : req.status === "ACCEPTED" ? "Zaakceptowany" : "Odrzucony"}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">{req.reason}</p>
                  {req.dateStart && (
                    <div className="text-xs text-slate-400 mt-1">
                      Termin: {new Date(req.dateStart).toLocaleDateString()}
                      {req.dateEnd ? ` - ${new Date(req.dateEnd).toLocaleDateString()}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Status zgłoszonych usterek pojazdów */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h3 className="text-xl font-bold mb-4 text-slate-200">Twoje zgłoszenia techniczne</h3>
          {vehicleDefects.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak zgłoszonych usterek.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {vehicleDefects.map((def) => (
                <div key={def.id} className="bg-slate-900 border border-slate-700 p-3.5 rounded-lg text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-bold text-rose-300">{def.title}</span>
                      <div className="text-xs text-slate-400">
                        Pojazd: {def.vehicle.fleetNumber} ({def.vehicle.model})
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        def.status === "NOWE"
                          ? "bg-rose-900/60 text-rose-300"
                          : def.status === "WARSZTAT"
                          ? "bg-amber-900/60 text-amber-300"
                          : "bg-emerald-900/60 text-emerald-300"
                      }`}
                    >
                      {def.status === "NOWE" ? "Zgłoszona" : def.status === "WARSZTAT" ? "W naprawie" : "Naprawiona"}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 text-xs">{def.description}</p>
                  {(def.defectType || def.workshopStart || def.adminNotes) && (
                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] space-y-0.5 text-amber-300/90">
                      {def.defectType && <div>Kategoria usterki: <b>{def.defectType}</b></div>}
                      {def.workshopStart && (
                        <div>
                          Warsztat: {new Date(def.workshopStart).toLocaleDateString()}
                          {def.workshopEnd ? ` do ${new Date(def.workshopEnd).toLocaleDateString()}` : ""}
                        </div>
                      )}
                      {def.adminNotes && <div className="text-slate-300">Notatka zarządu: {def.adminNotes}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
