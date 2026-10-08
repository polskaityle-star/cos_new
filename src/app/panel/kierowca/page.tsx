import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { sortBrigades, getDayLabel, getDayBadgeClass } from "@/lib/brigades";
import { getRoleLabel, getRoleBadgeClass, canAccessManagementPanel } from "@/lib/roles";
import DriverEtatModal from "@/components/DriverEtatModal";
import AvatarManager from "@/components/AvatarManager";
import DriverRequestForm from "@/components/DriverRequestForm";

export const dynamic = "force-dynamic";

export default async function DriverPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const [currentUser, duties, driverRequests, vehicleDefects, allVehicles, allLines, rawBrigadeSchedules] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { assignedVehicle: true },
    }),
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

  const driverCarrier = currentUser?.carrier || session.user.carrier;
  const filteredBrigades = rawBrigadeSchedules.filter((b) => {
    if (!driverCarrier) return true;
    if (b.carrier) return b.carrier === driverCarrier;
    if (b.line?.carrier) return b.line.carrier === driverCarrier;
    return !b.carrier && !b.line?.carrier;
  });
  const brigadeSchedules = sortBrigades(filteredBrigades);

  const availableVehicles = driverCarrier
    ? allVehicles.filter((v) => v.carrier === driverCarrier)
    : allVehicles;

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
      {/* Modal wyboru etatu jeśli kierowca nie ma jeszcze zdefiniowanych dni */}
      <DriverEtatModal currentWorkingDays={currentUser?.workingDays} />

      {/* Nagłówek panelu z profilem, avatarem i numerem służbowym */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-700 pb-6 bg-slate-800/40 p-6 rounded-2xl border">
        <div className="flex items-center gap-4">
          <AvatarManager
            currentAvatar={currentUser?.avatar}
            username={currentUser?.username || session.user.username}
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-extrabold text-white">
                {currentUser?.username || session.user.username}
              </h1>
              {currentUser?.badgeNumber && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded font-mono font-bold text-xs">
                  {currentUser.badgeNumber}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRoleBadgeClass(currentUser?.role || session.user.role)}`}>
                {getRoleLabel(currentUser?.role || session.user.role)}
              </span>
              <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-xs font-semibold">
                {driverCarrier || "Brak przydziału"}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300 pt-1">
              <span>
                📅 <b>Etat:</b> {currentUser?.workingDays ? `${currentUser.workingDays} (${currentUser.workingDays.split(",").length}/7)` : <span className="text-amber-400 font-semibold">Nieustalony (Wybierz etat)</span>}
              </span>
              <span>
                🚌 <b>Stały pojazd:</b> {currentUser?.assignedVehicle ? (
                  <span className="text-emerald-400 font-semibold">
                    #{currentUser.assignedVehicle.fleetNumber} ({currentUser.assignedVehicle.model})
                  </span>
                ) : (
                  <span className="text-slate-400">Brak stałego wozu</span>
                )}
              </span>
            </div>
          </div>
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
          {canAccessManagementPanel(currentUser?.role || session.user.role) && (
            <Link
              href="/panel/zarzad"
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-3.5 py-2 rounded-lg transition-colors text-xs shadow"
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
                  <div className="text-xs text-slate-400 mt-1">
                    Data służby: {new Date(duty.date).toLocaleDateString("pl-PL")}
                  </div>

                  {duty.notes && (
                    <div className="mt-2 text-xs bg-slate-950/60 p-2 rounded border border-slate-800 text-amber-300">
                      ℹ️ <b>Uwagi do służby:</b> {duty.notes}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {duty.status === "SCHEDULED" && (() => {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                    const dutyD = new Date(duty.date);
                    const dutyStr = `${dutyD.getFullYear()}-${String(dutyD.getMonth() + 1).padStart(2, "0")}-${String(dutyD.getDate()).padStart(2, "0")}`;
                    const isFuture = dutyStr > todayStr;

                    if (isFuture) {
                      return (
                        <span
                          className="bg-slate-950/80 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed flex items-center gap-1.5"
                          title="Raport dostępny w dniu odbywania służby lub po jej zakończeniu"
                        >
                          🔒 Dostępny w dniu służby ({dutyD.toLocaleDateString("pl-PL")})
                        </span>
                      );
                    }

                    return (
                      <a
                        href={`/panel/kierowca/raport?dutyId=${duty.id}`}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm shadow"
                      >
                        Złóż raport
                      </a>
                    );
                  })()}
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
                  <th className="py-3 px-4">Przystanki</th>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-amber-900/50 text-amber-300 border border-amber-600/40 text-xs px-2 py-0.5 rounded font-mono font-bold">
                          {b.brigadeNumber}
                        </span>
                        <span
                          className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border ${getDayBadgeClass(
                            b.brigadeNumber,
                            b.notes
                          )}`}
                        >
                          {getDayLabel(b.brigadeNumber, b.notes)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold whitespace-nowrap text-xs">
                      <div><span className="text-slate-400 font-normal">Wyjazd:</span> {b.startTime || "—"}</div>
                      <div><span className="text-slate-400 font-normal">Zjazd:</span> {b.endTime || "—"}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 font-mono">
                      <div><span className="text-slate-400 font-sans">1. przystanek:</span> {b.firstStopDeparture || "—"}</div>
                      <div><span className="text-slate-400 font-sans">Ost. przystanek:</span> {b.lastStopArrival || "—"}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div><b>Wyjazd:</b> {b.startLocation}</div>
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

      {/* Wgląd do Taboru Twojego Przewoźnika (Wymóg 6) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-cyan-400">
              <span>🚌 Tabor Twojego Przewoźnika ({driverCarrier || "Wszystkie"})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Przeglądaj autobusy przypisane do Twojej zajezdni, ich aktualne stany liczników oraz status techniczny.
            </p>
          </div>
          <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-slate-300 font-mono">
            Dostępne pojazdy: <b className="text-cyan-400">{availableVehicles.length}</b>
          </span>
        </div>

        {availableVehicles.length === 0 ? (
          <p className="text-slate-400 text-sm">Brak dostępnych pojazdów dla Twojego przewoźnika.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableVehicles.map((veh) => (
              <div
                key={veh.id}
                className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden flex flex-col justify-between hover:border-slate-500 transition-colors shadow-md"
              >
                {veh.imageUrl ? (
                  <div className="h-36 w-full overflow-hidden bg-slate-950 relative">
                    <img
                      src={veh.imageUrl}
                      alt={veh.model}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-amber-300 font-mono font-black text-xs px-2 py-0.5 rounded border border-amber-500/40">
                      {veh.fleetNumber}
                    </span>
                    <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700">
                      {veh.carrier}
                    </span>
                  </div>
                ) : (
                  <div className="h-28 bg-gradient-to-br from-slate-950 to-slate-800 flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="text-3xl">🚌</div>
                    <div className="text-right">
                      <span className="bg-amber-900/60 text-amber-300 font-mono font-black text-base px-2 py-0.5 rounded border border-amber-500/40 block">
                        {veh.fleetNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{veh.carrier}</span>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-2 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm line-clamp-1">{veh.model}</h3>
                    <div className="text-xs text-slate-400 font-mono">{veh.registration}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Przebieg:</span>
                      <span className="font-mono text-cyan-300 font-bold">{(veh.mileage || 0).toLocaleString()} km</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        veh.status === "SPRAWNY"
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-600/40"
                          : veh.status === "WARSZTAT"
                          ? "bg-amber-900/60 text-amber-300 border border-amber-600/40"
                          : "bg-rose-900/60 text-rose-300 border border-rose-600/40"
                      }`}
                    >
                      {veh.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Wnioski Kierowcy i Zgłaszanie Awarii */}
      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-amber-400">
            <span>📝 Złóż wniosek do Zarządu</span>
          </h2>
          <DriverRequestForm
            scheduledDuties={scheduledDuties}
            availableVehicles={availableVehicles}
          />
        </section>

        {/* Zgłaszanie Awarii Pojazdu (tylko tabor swojego przewoźnika) */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-rose-400">
            <span>🚨 Zgłoś usterkę / zdarzenie pojazdu</span>
          </h2>
          <form action="/api/panel/kierowca/usterka" method="POST" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Pojazd z taboru ({driverCarrier}) *
              </label>
              <select
                name="vehicleId"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100"
              >
                <option value="">-- Wybierz pojazd --</option>
                {availableVehicles.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    #{veh.fleetNumber} - {veh.model} [{veh.carrier}] ({veh.registration})
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

      {/* Twoje Zgłoszenia i Wnioski (Aktywne oraz Historia) */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Wnioski kierowcy: Aktywne i Historia */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-3 text-slate-200 flex items-center justify-between">
              <span>Twoje aktywne wnioski</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-amber-400 font-mono">
                {driverRequests.filter((r) => r.status === "PENDING").length}
              </span>
            </h3>
            {driverRequests.filter((r) => r.status === "PENDING").length === 0 ? (
              <p className="text-slate-400 text-sm">Brak oczekujących wniosków.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {driverRequests
                  .filter((r) => r.status === "PENDING")
                  .map((req) => (
                    <div key={req.id} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-amber-300">
                          {req.type === "URLOP"
                            ? "🏖 Urlop"
                            : req.type === "DODATKOWA_SLUZBA"
                            ? "➕ Dodatkowa służba"
                            : req.type === "STALY_POJAZD"
                            ? "🚌 Stały pojazd"
                            : req.type === "ZMIANA_STALEGO_POJAZDU"
                            ? "🔄 Zmiana stałego pojazdu"
                            : req.type === "USUNIECIE_STALEGO_POJAZDU"
                            ? "🗑️ Rezygnacja ze stałego pojazdu"
                            : req.type === "ZMIANA_ETATU"
                            ? "📅 Zmiana etatu"
                            : "❌ Anulowanie służby"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-yellow-900/60 text-yellow-300">
                          Oczekuje na zarząd
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1 text-xs">{req.reason}</p>
                      {req.dateStart && (
                        <div className="text-[11px] text-slate-400 mt-1">
                          Termin: {new Date(req.dateStart).toLocaleDateString("pl-PL")}
                          {req.dateEnd ? ` do ${new Date(req.dateEnd).toLocaleDateString("pl-PL")}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Historia wniosków */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center justify-between">
              <span>📜 Historia wniosków (rozpatrzone)</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                {driverRequests.filter((r) => r.status !== "PENDING").length}
              </span>
            </h4>
            {driverRequests.filter((r) => r.status !== "PENDING").length === 0 ? (
              <p className="text-slate-500 text-xs">Brak historii wniosków.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {driverRequests
                  .filter((r) => r.status !== "PENDING")
                  .map((req) => (
                    <div key={req.id} className="bg-slate-900/70 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {req.type === "URLOP"
                            ? "🏖 Urlop"
                            : req.type === "DODATKOWA_SLUZBA"
                            ? "➕ Dodatkowa służba"
                            : req.type === "STALY_POJAZD"
                            ? "🚌 Stały pojazd"
                            : req.type === "ZMIANA_STALEGO_POJAZDU"
                            ? "🔄 Zmiana stałego pojazdu"
                            : req.type === "USUNIECIE_STALEGO_POJAZDU"
                            ? "🗑️ Rezygnacja ze stałego pojazdu"
                            : req.type === "ZMIANA_ETATU"
                            ? "📅 Zmiana etatu"
                            : "❌ Anulowanie służby"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            req.status === "ACCEPTED"
                              ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                              : "bg-red-900/60 text-red-300 border border-red-700/50"
                          }`}
                        >
                          {req.status === "ACCEPTED" ? "Zaakceptowany" : "Odrzucony"}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-1">{req.reason}</p>
                      {req.responseNotes && (
                        <div className="text-amber-400/90 mt-1">Notatka zarządu: {req.responseNotes}</div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-1">
                        Złożono: {new Date(req.createdAt).toLocaleDateString("pl-PL")}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Zgłoszenia techniczne: Aktywne i Historia */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-3 text-slate-200 flex items-center justify-between">
              <span>Aktywne zgłoszenia usterek</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-rose-400 font-mono">
                {vehicleDefects.filter((d) => d.status === "NOWE" || d.status === "WARSZTAT").length}
              </span>
            </h3>
            {vehicleDefects.filter((d) => d.status === "NOWE" || d.status === "WARSZTAT").length === 0 ? (
              <p className="text-slate-400 text-sm">Brak aktywnych usterek w toku.</p>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {vehicleDefects
                  .filter((d) => d.status === "NOWE" || d.status === "WARSZTAT")
                  .map((def) => (
                    <div key={def.id} className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-bold text-rose-300">{def.title}</span>
                          <div className="text-xs text-slate-400">
                            Pojazd: #{def.vehicle.fleetNumber} ({def.vehicle.model})
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold ${
                            def.status === "NOWE"
                              ? "bg-rose-900/60 text-rose-300 border border-rose-700/50"
                              : "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                          }`}
                        >
                          {def.status === "NOWE" ? "Zgłoszona" : "W naprawie"}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1 text-xs">{def.description}</p>
                      {def.adminNotes && (
                        <div className="text-amber-400/90 text-xs mt-1">Notatka warsztatu: {def.adminNotes}</div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Historia usterek */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center justify-between">
              <span>🔧 Historia zgłoszeń technicznych</span>
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">
                {vehicleDefects.filter((d) => d.status === "NAPRAWIONE" || d.status === "ODRZUCONE").length}
              </span>
            </h4>
            {vehicleDefects.filter((d) => d.status === "NAPRAWIONE" || d.status === "ODRZUCONE").length === 0 ? (
              <p className="text-slate-500 text-xs">Brak naprawionych usterek w historii.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {vehicleDefects
                  .filter((d) => d.status === "NAPRAWIONE" || d.status === "ODRZUCONE")
                  .map((def) => (
                    <div key={def.id} className="bg-slate-900/70 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <div className="flex justify-between items-center gap-2">
                        <div>
                          <span className="font-semibold text-slate-200">{def.title}</span>
                          <span className="text-slate-500 ml-1.5">#{def.vehicle.fleetNumber}</span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            def.status === "NAPRAWIONE"
                              ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {def.status === "NAPRAWIONE" ? "Naprawiona" : "Odrzucona"}
                        </span>
                      </div>
                      {def.adminNotes && (
                        <div className="text-slate-400 mt-1">Rozwiązanie: {def.adminNotes}</div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
