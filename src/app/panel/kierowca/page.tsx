import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { sortBrigades, getDayLabel, getDayBadgeClass, isPeakBrigade, getBrigadeTypeBadgeClass } from "@/lib/brigades";
import { getRoleLabel, getRoleBadgeClass, canAccessManagementPanel } from "@/lib/roles";
import DriverEtatModal from "@/components/DriverEtatModal";
import AvatarManager from "@/components/AvatarManager";
import DriverRequestForm from "@/components/DriverRequestForm";
import DefectReportForm from "@/components/DefectReportForm";
import LiveClock from "@/components/LiveClock";

export const dynamic = "force-dynamic";

export default async function DriverPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const [currentUser, duties, driverRequests, vehicleDefects, allVehicles, allLines, rawBrigadeSchedules, driverNotifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { assignedVehicle: true },
    }),
    prisma.duty.findMany({
      where: { userId: session.user.id },
      include: { line: true, vehicle: true, replacementVehicle: true, report: true },
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
      include: {
        defects: {
          where: { status: { in: ["NOWE", "WARSZTAT"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { fleetNumber: "asc" },
    }),
    prisma.line.findMany({
      orderBy: { number: "asc" },
    }),
    prisma.brigadeSchedule.findMany({
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
    prisma.driverNotification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const isOwner = currentUser?.role === "WLASCICIEL" || session.user.role === "WLASCICIEL" || currentUser?.username === "Godksawiss" || session.user.username === "Godksawiss";
  const driverCarrier = currentUser?.carrier || session.user.carrier;
  const filteredBrigades = rawBrigadeSchedules.filter((b) => {
    if (isOwner) return true;
    if (!driverCarrier) return true;
    if (b.carrier) return b.carrier === driverCarrier;
    if (b.line?.carrier) return b.line.carrier === driverCarrier;
    return !b.carrier && !b.line?.carrier;
  });
  const brigadeSchedules = sortBrigades(filteredBrigades);

  // Wymóg 1: Właściciel ma pełną widoczność taboru (VBP i VMPK)
  const availableVehicles = isOwner
    ? allVehicles
    : driverCarrier
    ? allVehicles.filter((v) => v.carrier === driverCarrier)
    : allVehicles;

  // Wymóg 10 i 11: Niezaliczone służby (data z przeszłości bez zatwierdzonego raportu)
  // Służby dodatkowe z zatwierdzonym raportem odliczają się od niezaliczonych służb (1:1)
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(now);

  const grossMissedDuties = duties.filter((d) => {
    const dDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date(d.date));
    const isExtraDuty = Boolean(d.isExtra || d.notes?.toLowerCase().includes("dodatkow"));
    if (dDateStr < todayStr && !isExtraDuty) {
      const isAccepted = d.report?.status === "ACCEPTED";
      return !isAccepted;
    }
    return false;
  });

  const compensatedExtraDuties = duties.filter((d) => {
    const isExtraDuty = Boolean(d.isExtra || d.notes?.toLowerCase().includes("dodatkow"));
    return isExtraDuty && d.report?.status === "ACCEPTED";
  });

  const netUnfulfilledCount = Math.max(0, grossMissedDuties.length - compensatedExtraDuties.length);
  const unfulfilledCount = netUnfulfilledCount;

  // Wymóg 5: Przy 10 niezaliczonych służbach konto zostaje zawieszone, a stały pojazd odebrany (etat bez zmian)
  let isSuspended = currentUser?.suspended || unfulfilledCount >= 10;
  if (unfulfilledCount >= 10 && (!currentUser?.suspended || currentUser?.assignedVehicleId)) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        suspended: true,
        assignedVehicleId: null,
      },
    });
    isSuspended = true;
  }

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
          <LiveClock />
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

      {/* Ostrzeżenia o niezaliczonych służbach / zawieszeniu konta (Wymogi 5, 10, 11) */}
      {isSuspended ? (
        <div className="bg-red-950/80 border-2 border-red-600 p-5 rounded-2xl text-red-200 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white font-extrabold text-lg">
              <span className="text-2xl">🚫</span> KONTO KIEROWCY ZAWIESZONE ({unfulfilledCount} niezaliczonych służb netto)
            </div>
            <p className="text-xs text-red-300">
              Przekroczono limit 10 niezaliczonych służb (Zaległe z przeszłości: {grossMissedDuties.length}, odrobione przez dodatkowe służby: {compensatedExtraDuties.length}).
              Zgodnie z regulaminem Twój stały pojazd został zwolniony (Twój etat pozostaje bez zmian).
              Aby odblokować możliwość wykonywania służb, musisz złożyć poniżej <b>Wniosek o odwieszenie konta</b> do Zarządu.
            </p>
          </div>
          <a
            href="#wnioski-kierowcy"
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-lg text-xs whitespace-nowrap transition-colors shadow-lg cursor-pointer"
          >
            Złóż wniosek o odwieszenie &darr;
          </a>
        </div>
      ) : unfulfilledCount >= 5 ? (
        <div className="bg-amber-950/80 border-2 border-amber-600 p-5 rounded-2xl text-amber-200 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <span className="text-2xl">⚠️</span> OSTRZEŻENIE: Masz {unfulfilledCount} niezaliczonych służb!
            </div>
            <p className="text-xs text-amber-300">
              Zalecamy jak najszybsze nadrobienie zaległości poprzez złożenie <b>Wniosku o dodatkową służbę</b> (każda zaliczona służba dodatkowa redukuje liczbę zaległości o 1).
              Zaległe z przeszłości: <b>{grossMissedDuties.length}</b>, odrobione przez służby dodatkowe: <b>{compensatedExtraDuties.length}</b>. Pamiętaj: przy 10 niezaliczonych służbach konto zostanie automatycznie zawieszone!
            </p>
          </div>
          <a
            href="#wnioski-kierowcy"
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2.5 rounded-lg text-xs whitespace-nowrap transition-colors shadow-lg cursor-pointer"
          >
            Złóż wniosek o dodatkową służbę &darr;
          </a>
        </div>
      ) : compensatedExtraDuties.length > 0 && grossMissedDuties.length > 0 ? (
        <div className="bg-emerald-950/60 border border-emerald-600/70 p-4 rounded-xl text-emerald-200 text-xs flex items-center justify-between gap-4">
          <span>
            ℹ️ <b>Status bilansu służb:</b> Zaległe z przeszłości: {grossMissedDuties.length}, odrobione przez zaliczone służby dodatkowe: {compensatedExtraDuties.length} (Pozostało do odrobienia netto: {unfulfilledCount}).
          </span>
        </div>
      ) : null}

      {/* 📨 Komunikacja z Zarządem: Otrzymane, Nowe Zapytanie i Historia Wysłanych (Wymogi 3, 9, 9.1) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6" id="wiadomosci">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-sky-400">
              <span>💬 Komunikacja Kierowcy z Zarządem</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Odbieraj dyspozycje od Zarządu, odpowiadaj na wiadomości oraz przesyłaj własne zapytania do dyspozytorni.
            </p>
          </div>
          {driverNotifications.filter((n) => n.direction !== "TO_MANAGEMENT" && !n.read).length > 0 && (
            <span className="bg-sky-500 text-white font-bold text-xs px-2.5 py-1 rounded-full animate-pulse self-start sm:self-auto">
              Nowe wiadomości: {driverNotifications.filter((n) => n.direction !== "TO_MANAGEMENT" && !n.read).length}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Kolumna Lewa: Wiadomości od Zarządu (z opcją odpowiedzi) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-sky-300 flex items-center justify-between">
              <span>📬 Wiadomości od Zarządu ({driverNotifications.filter((n) => n.direction !== "TO_MANAGEMENT").length})</span>
            </h3>

            {driverNotifications.filter((n) => n.direction !== "TO_MANAGEMENT").length === 0 ? (
              <p className="text-slate-400 text-xs bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                Brak wiadomości od dyspozytorni lub Zarządu.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {driverNotifications
                  .filter((n) => n.direction !== "TO_MANAGEMENT")
                  .map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                        notif.read
                          ? "bg-slate-900/60 border-slate-800 text-slate-300"
                          : "bg-sky-950/40 border-sky-600/60 text-sky-100 shadow-md"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{notif.title}</span>
                          <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 font-mono">
                            Od: {notif.sender}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(notif.createdAt).toLocaleString("pl-PL")}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Odpowiedź kierowcy */}
                      {notif.reply ? (
                        <div className="bg-slate-950/80 border border-slate-700/80 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                            <span>💬 Twoja odpowiedź ({notif.replyBy || "Kierowca"}):</span>
                            {notif.repliedAt && (
                              <span className="text-[10px] text-slate-400 font-mono font-normal">
                                {new Date(notif.repliedAt).toLocaleString("pl-PL")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-200 whitespace-pre-wrap">{notif.reply}</p>
                        </div>
                      ) : (
                        <form action="/api/panel/kierowca/wiadomosc-odpowiedz" method="POST" className="pt-2 border-t border-slate-800/80 flex flex-wrap sm:flex-nowrap gap-2 items-center">
                          <input type="hidden" name="notificationId" value={notif.id} />
                          <input
                            type="text"
                            name="replyText"
                            required
                            placeholder="Odpowiedz Zarządowi..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                          />
                          <button
                            type="submit"
                            className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors shadow"
                          >
                            💬 Odpowiedz
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Kolumna Prawa: Formularz wysłania wiadomości do Zarządu + Historia wysłanych */}
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-700 p-4 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <span>✉️ Wyślij nową wiadomość / zapytanie do Zarządu</span>
              </h3>
              <form action="/api/panel/kierowca/wiadomosc-zarzad" method="POST" className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 font-semibold">Tytuł wiadomości *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="np. Zapytanie o grafik, Zgłoszenie sprawy kadrowej"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1 font-semibold">Treść wiadomości *</label>
                  <textarea
                    name="message"
                    required
                    rows={3}
                    placeholder="Wpisz treść pytania lub informacji dla dyspozytora / Zarządu..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500 resize-none"
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span>📨 Wyślij do Zarządu</span>
                </button>
              </form>
            </div>

            {/* Historia wysłanych wiadomości do Zarządu */}
            {driverNotifications.filter((n) => n.direction === "TO_MANAGEMENT").length > 0 && (
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  📤 Historia Twoich wiadomości do Zarządu ({driverNotifications.filter((n) => n.direction === "TO_MANAGEMENT").length}):
                </h4>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {driverNotifications
                    .filter((n) => n.direction === "TO_MANAGEMENT")
                    .map((msg) => (
                      <div key={msg.id} className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5">
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-bold text-white">{msg.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(msg.createdAt).toLocaleString("pl-PL")}
                          </span>
                        </div>
                        <p className="text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                        {msg.reply ? (
                          <div className="bg-sky-950/70 border border-sky-700/60 p-2.5 rounded text-sky-200 mt-1 space-y-0.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                              <span>💬 Odpowiedź Zarządu ({msg.replyBy || "Dyspozytor"}):</span>
                              {msg.repliedAt && (
                                <span className="text-[10px] text-slate-400 font-mono font-normal">
                                  {new Date(msg.repliedAt).toLocaleString("pl-PL")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white whitespace-pre-wrap">{msg.reply}</p>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-400 font-medium">
                            ⏳ Oczekuje na odpowiedź Zarządu...
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Podsumowanie postępów kierowcy */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Zrealizowane służby</span>
          <div className="text-2xl font-black text-emerald-400 mt-2">{completedDuties.length} / {duties.length}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-col justify-between">
          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Niezaliczone służby</span>
          <div className={`text-2xl font-black mt-2 ${unfulfilledCount >= 10 ? "text-red-400" : unfulfilledCount >= 5 ? "text-amber-400" : "text-slate-300"}`}>
            {unfulfilledCount}
          </div>
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

                  {duty.replacementVehicle && (
                    <div className="mt-2 text-xs bg-purple-950/80 border border-purple-500/60 p-2.5 rounded-lg text-purple-200 flex items-center gap-2">
                      <span className="text-base">🔄</span>
                      <div>
                        <b className="text-white">Wóz zastępczy (awaria pojazdu):</b> #{duty.replacementVehicle.fleetNumber} ({duty.replacementVehicle.model}) [{duty.replacementVehicle.registration}]
                      </div>
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
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 gap-1">
              <span>Wykaz brygad (widok do 4 kolumn):</span>
              <span className="text-amber-300 font-semibold">↔️ Przesuń tabelę w bok, aby zobaczyć trasę, przesiadki i uwagi</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-700 shadow-inner scrollbar-thin scrollbar-thumb-slate-700">
              <table className="min-w-[1100px] w-full text-left text-sm">
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
                  {brigadeSchedules.map((b) => {
                    const isPeak = isPeakBrigade(b);
                    return (
                      <tr
                        key={b.id}
                        className={`hover:bg-slate-800/60 transition-colors ${
                          isPeak ? "bg-purple-950/15" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          Linia {b.line?.number}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
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
                            <span
                              className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded border ${getBrigadeTypeBadgeClass(
                                b
                              )}`}
                            >
                              {isPeak ? "⚡ Szczytowa" : "🚌 Normalna"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-400 font-bold whitespace-nowrap text-xs">
                          {isPeak ? (
                            <div className="space-y-1">
                              <div className="bg-purple-900/40 px-2 py-0.5 rounded border border-purple-800/40">
                                <span className="text-purple-300 font-sans text-[10px] block font-bold">I zmiana:</span>
                                <div><span className="text-slate-400 font-normal">Wyjazd:</span> {b.startTime || "—"}</div>
                                <div><span className="text-slate-400 font-normal">Zjazd:</span> {b.endTime || "—"}</div>
                              </div>
                              <div className="bg-purple-900/40 px-2 py-0.5 rounded border border-purple-800/40">
                                <span className="text-purple-300 font-sans text-[10px] block font-bold">II zmiana:</span>
                                <div><span className="text-slate-400 font-normal">Wyjazd:</span> {b.startTime2 || "—"}</div>
                                <div><span className="text-slate-400 font-normal">Zjazd:</span> {b.endTime2 || "—"}</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div><span className="text-slate-400 font-normal">Wyjazd:</span> {b.startTime || "—"}</div>
                              <div><span className="text-slate-400 font-normal">Zjazd:</span> {b.endTime || "—"}</div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300 font-mono">
                          {isPeak ? (
                            <div className="space-y-1">
                              <div className="bg-slate-900/60 p-1 rounded border border-slate-700/60">
                                <span className="text-purple-300 font-sans text-[10px] block font-bold">I:</span>
                                <div><span className="text-slate-400 font-sans">1.:</span> {b.firstStopDeparture || "—"}</div>
                                <div><span className="text-slate-400 font-sans">Ost.:</span> {b.lastStopArrival || "—"}</div>
                              </div>
                              <div className="bg-slate-900/60 p-1 rounded border border-slate-700/60">
                                <span className="text-purple-300 font-sans text-[10px] block font-bold">II:</span>
                                <div><span className="text-slate-400 font-sans">1.:</span> {b.firstStopDeparture2 || "—"}</div>
                                <div><span className="text-slate-400 font-sans">Ost.:</span> {b.lastStopArrival2 || "—"}</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div><span className="text-slate-400 font-sans">1. przystanek:</span> {b.firstStopDeparture || "—"}</div>
                              <div><span className="text-slate-400 font-sans">Ost. przystanek:</span> {b.lastStopArrival || "—"}</div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">
                          {isPeak ? (
                            <div className="space-y-1">
                              <div className="bg-slate-900/60 p-1 rounded border border-slate-700/60">
                                <span className="text-purple-300 text-[10px] block font-bold">I zmiana:</span>
                                <div><b>Wyjazd:</b> {b.startLocation || "—"}</div>
                                <div className="text-slate-400"><b>Zjazd:</b> {b.endLocation || "—"}</div>
                              </div>
                              <div className="bg-slate-900/60 p-1 rounded border border-slate-700/60">
                                <span className="text-purple-300 text-[10px] block font-bold">II zmiana:</span>
                                <div><b>Wyjazd:</b> {b.startLocation2 || "—"}</div>
                                <div className="text-slate-400"><b>Zjazd:</b> {b.endLocation2 || "—"}</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div><b>Wyjazd:</b> {b.startLocation || "—"}</div>
                              <div className="text-slate-400"><b>Zjazd:</b> {b.endLocation || "—"}</div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">
                          {b.driverChanges || <span className="text-slate-500 italic">Brak przesiadek</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {b.notes || <span className="text-slate-600">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Wgląd do Taboru Twojego Przewoźnika (Wymóg 6) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-cyan-400">
              <span>
                {isOwner
                  ? "🚌 Pełna Flota VZTM (VMPK i VBP - Wszystkie)"
                  : `🚌 Tabor Twojego Przewoźnika (${driverCarrier || "Wszystkie"})`}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isOwner
                ? "Jako Właściciel posiadasz pełny wgląd we wszystkie autobusy w bazach VMPK i VBP oraz ich stan techniczny."
                : `Przeglądaj autobusy przypisane do Twojej zajezdni (${driverCarrier}), ich aktualne stany liczników oraz status techniczny.`}
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

                  {veh.status === "WARSZTAT" && veh.defects && veh.defects.length > 0 && (
                    <div className="mt-2.5 bg-amber-950/70 border border-amber-500/50 p-2.5 rounded-lg text-xs space-y-1">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                        <span>🛠️ Na warsztacie:</span>
                        <span className="text-white">{veh.defects[0].title}</span>
                      </div>
                      {veh.defects[0].description && (
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          <b className="text-slate-400">Opis usterki:</b> {veh.defects[0].description}
                        </p>
                      )}
                      {veh.defects[0].adminNotes && (
                        <div className="text-amber-400 text-[11px] font-medium pt-0.5 border-t border-amber-900/40">
                          <b>Notatka warsztatu:</b> {veh.defects[0].adminNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Wnioski Kierowcy i Zgłaszanie Awarii */}
      <div className="grid lg:grid-cols-2 gap-8" id="wnioski-kierowcy">
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-amber-400">
            <span>📝 Złóż wniosek do Zarządu</span>
          </h2>
          <DriverRequestForm
            scheduledDuties={scheduledDuties}
            availableVehicles={availableVehicles}
            canReinstate={unfulfilledCount >= 10 || isSuspended}
          />
        </section>

        {/* Zgłaszanie Awarii Pojazdu (ze zdjęciami - Wymóg 6) */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-rose-400">
            <span>🚨 Zgłoś usterkę / zdarzenie pojazdu</span>
          </h2>
          <DefectReportForm
            availableVehicles={availableVehicles.map((v) => ({
              id: v.id,
              fleetNumber: v.fleetNumber,
              model: v.model,
              carrier: v.carrier,
              registration: v.registration,
            }))}
            carrierLabel={isOwner ? "Wszystkie pojazdy VZTM" : driverCarrier || "Wszystkie"}
          />
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
                      {req.type === "URLOP" && (
                        <div className="pt-2 flex justify-end">
                          <form action={`/api/panel/kierowca/usun-urlop?requestId=${req.id}`} method="POST">
                            <button
                              type="submit"
                              className="bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-semibold shadow transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              🗑️ Anuluj / Usuń urlop
                            </button>
                          </form>
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
                        <div
                          className={`mt-1.5 p-1.5 rounded text-[11px] ${
                            req.status === "REJECTED"
                              ? "bg-red-950/60 text-red-200 border border-red-800/40"
                              : "bg-emerald-950/60 text-emerald-200 border border-emerald-800/40"
                          }`}
                        >
                          <b>{req.status === "REJECTED" ? "❌ Powód odrzucenia:" : "💬 Notatka Zarządu:"}</b>{" "}
                          {req.responseNotes}
                        </div>
                      )}
                      {req.type === "URLOP" && (
                        <div className="pt-1.5 flex justify-end">
                          <form action={`/api/panel/kierowca/usun-urlop?requestId=${req.id}`} method="POST">
                            <button
                              type="submit"
                              className="bg-red-600/70 hover:bg-red-600 text-white px-2 py-0.5 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              🗑️ Usuń urlop
                            </button>
                          </form>
                        </div>
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
