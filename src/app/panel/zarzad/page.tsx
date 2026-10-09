import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ReportFileList from "@/components/ReportFileList";
import LiveClock from "@/components/LiveClock";
import DutyAssignmentForm from "@/components/DutyAssignmentForm";
import BrigadeCreationForm from "@/components/BrigadeCreationForm";
import BrigadeEditCard from "@/components/BrigadeEditCard";
import { sortBrigades, getDayLabel, getDayBadgeClass } from "@/lib/brigades";
import {
  canAccessManagementPanel,
  canManageDuties,
  canManageLines,
  canManageFleet,
  canManageRequests,
  canManageUsers,
  canAssignReplacementVehicle,
  getRoleLabel,
  getRoleBadgeClass,
  ROLES,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminPanel({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    driver?: string;
    expected?: string;
    userCarrier?: string;
    vehCarrier?: string;
    lineCarrier?: string;
    prefillDriver?: string;
    prefillDate?: string;
    prefillVehicle?: string;
    prefillReqId?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const userName = (session.user as any)?.username || "";
  if (!canAccessManagementPanel(session.user.role, userName)) {
    redirect("/");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const {
    error,
    driver,
    expected,
    userCarrier,
    vehCarrier,
    lineCarrier,
    prefillDriver,
    prefillDate,
    prefillVehicle,
    prefillReqId,
  } = resolvedParams;

  const userRole = session.user.role || "KIEROWCA";
  const canUsers = canManageUsers(userRole, userName);
  const canLines = canManageLines(userRole, userName);
  const canFleet = canManageFleet(userRole, userName);
  const canDuties = canManageDuties(userRole, userName);
  const canReqs = canManageRequests(userRole, userName);
  const canReplaceVeh = canAssignReplacementVehicle(userRole, userName);

  const [
    currentDbUser,
    pendingUsers,
    allLines,
    allVehicles,
    activeUsers,
    pendingReports,
    allDuties,
    driverRequests,
    driverRequestsHistory,
    vehicleDefects,
    vehicleDefectsHistory,
    contactMessages,
    rawBrigadeSchedules,
    driverNotifications,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { assignedVehicle: true },
    }),
    prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.line.findMany({
      orderBy: { number: "asc" },
    }),
    prisma.vehicle.findMany({
      orderBy: { fleetNumber: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACCEPTED" },
      include: { assignedVehicle: true },
      orderBy: { username: "asc" },
    }),
    prisma.report.findMany({
      where: { status: "PENDING" },
      include: {
        duty: {
          include: {
            user: true,
            line: true,
            vehicle: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.duty.findMany({
      include: {
        user: true,
        line: true,
        vehicle: true,
        replacementVehicle: true,
        report: true,
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.driverRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.driverRequest.findMany({
      where: { status: { in: ["ACCEPTED", "REJECTED"] } },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.vehicleDefect.findMany({
      where: { status: { in: ["NOWE", "WARSZTAT"] } },
      include: { user: true, vehicle: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicleDefect.findMany({
      where: { status: { in: ["NAPRAWIONE", "ODRZUCONE"] } },
      include: { user: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.brigadeSchedule.findMany({
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
    prisma.driverNotification.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const brigadeSchedules = sortBrigades(rawBrigadeSchedules);
  const receivedDriverMessages = driverNotifications.filter((n) => n.direction === "TO_MANAGEMENT");
  const sentDriverMessages = driverNotifications.filter((n) => n.direction === "TO_DRIVER");

  return (
    <div className="space-y-10 pb-16">
      {/* Karta Profilowa Zarządu ze Screenshotu 1 + LiveClock (Wymogi 5 i 5.1) */}
      <div className="bg-slate-900/90 border border-slate-700/80 p-5 md:p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {currentDbUser?.avatar ? (
              <img
                src={currentDbUser.avatar}
                alt={currentDbUser.username}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-slate-600 flex items-center justify-center text-xl font-bold text-amber-400 shadow-md">
                {currentDbUser?.username?.slice(0, 2).toUpperCase() || "GO"}
              </div>
            )}
            {currentDbUser?.badgeNumber && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-mono font-black text-[10px] px-1.5 py-0.5 rounded-full border border-slate-900 shadow">
                {currentDbUser.badgeNumber}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {currentDbUser?.username || session.user.username}
              </h2>
              {currentDbUser?.badgeNumber && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded font-mono font-bold text-xs">
                  {currentDbUser.badgeNumber}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getRoleBadgeClass(currentDbUser?.role || userRole)}`}>
                {getRoleLabel(currentDbUser?.role || userRole)}
              </span>
              <span className="bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded text-xs font-bold">
                {currentDbUser?.carrier || "VMPK"}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300 pt-1">
              <span>
                📅 <b>Etat:</b> {currentDbUser?.workingDays ? `${currentDbUser.workingDays} (${currentDbUser.workingDays.split(",").length}/7)` : <span className="text-slate-400">PN,WT,SR,CZ,PT (5/7)</span>}
              </span>
              <span>
                🚌 <b>Stały pojazd:</b> {currentDbUser?.assignedVehicle ? (
                  <span className="text-emerald-400 font-semibold">
                    #{currentDbUser.assignedVehicle.fleetNumber} ({currentDbUser.assignedVehicle.model})
                  </span>
                ) : (
                  <span className="text-slate-400">Brak stałego wozu</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LiveClock />
          <Link
            href="/brygady"
            className="bg-amber-700 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
          >
            <span>📋 Wykaz Brygad</span>
          </Link>
          <Link
            href="/"
            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-600 shadow"
          >
            <span>🌐 Strona publiczna</span>
          </Link>
          <Link
            href="/panel/kierowca"
            className="bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
          >
            <span>Panel Kierowcy &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Alerty błędów walidacji */}
      {error === "urlop_conflict" && (
        <div className="bg-red-950/90 border-2 border-red-500 text-red-100 p-5 rounded-2xl flex items-start gap-4 shadow-xl">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-bold text-lg text-white">Brak możliwości przydzielenia służby!</h3>
            <p className="text-sm text-red-200 mt-1">
              Kierowca <b className="text-white underline">{driver || "wybrany pracownik"}</b> posiada w tym terminie <b>zaakceptowany urlop wypoczynkowy</b>. 
              Zgodnie z regulaminem VZTM Kielce, pracownik na urlopie nie może otrzymać służby w grafiku.
            </p>
          </div>
        </div>
      )}

      {error === "brigade_day_mismatch" && (
        <div className="bg-amber-950/90 border-2 border-amber-500 text-amber-100 p-5 rounded-2xl flex items-start gap-4 shadow-xl">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-bold text-lg text-white">Niezgodność dnia tygodnia dla wybranej brygady!</h3>
            <p className="text-sm text-amber-200 mt-1">
              Wybrana brygada wymaga harmonogramu typu: <b className="text-white uppercase underline">{expected || "inny dzień"}</b>. 
              Brygady sobotnie można przydzielać wyłącznie w soboty, niedzielne w niedziele, a brygady robocze od poniedziałku do piątku.
            </p>
          </div>
        </div>
      )}

      {error === "carrier_vehicle_mismatch" && (
        <div className="bg-rose-950/90 border-2 border-rose-500 text-rose-100 p-5 rounded-2xl flex items-start gap-4 shadow-xl">
          <span className="text-3xl">🚫</span>
          <div>
            <h3 className="font-bold text-lg text-white">Niezgodność przewoźnika dla pojazdu!</h3>
            <p className="text-sm text-rose-200 mt-1">
              Kierowca jest przypisany do przewoźnika <b className="text-white underline">{userCarrier}</b>, natomiast wybrany autobus należy do floty <b className="text-white underline">{vehCarrier}</b>. 
              Nie można przydzielać taboru VMPK kierowcom VBP ani taboru VBP kierowcom VMPK.
            </p>
          </div>
        </div>
      )}

      {error === "carrier_line_mismatch" && (
        <div className="bg-rose-950/90 border-2 border-rose-500 text-rose-100 p-5 rounded-2xl flex items-start gap-4 shadow-xl">
          <span className="text-3xl">🚫</span>
          <div>
            <h3 className="font-bold text-lg text-white">Niezgodność przewoźnika dla linii!</h3>
            <p className="text-sm text-rose-200 mt-1">
              Kierowca jest przypisany do przewoźnika <b className="text-white underline">{userCarrier}</b>, natomiast wybrana linia jest dedykowana dla operatora <b className="text-white underline">{lineCarrier}</b>.
            </p>
          </div>
        </div>
      )}

      {error === "missing_vehicle" && (
        <div className="bg-red-950/90 border-2 border-red-500 text-red-100 p-5 rounded-2xl flex items-start gap-4 shadow-xl">
          <span className="text-3xl">🚌</span>
          <div>
            <h3 className="font-bold text-lg text-white">Wymagany pojazd z taboru!</h3>
            <p className="text-sm text-red-200 mt-1">
              Przydzielenie służby wymaga wybrania sprawnego autobusu z taboru. Wybierz pojazd przypisany do Twojego przewoźnika.
            </p>
          </div>
        </div>
      )}

      {/* Nagłówek i statystyki */}
      <div className="border-b border-slate-700 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-amber-400">Panel Zarządzania VZTM</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${getRoleBadgeClass(userRole)}`}>
              {session.user.badgeNumber ? `[${session.user.badgeNumber}] ` : ""}{getRoleLabel(userRole)}
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Zarządzanie personelem, flotą taboru, liniami, brygadami, wnioskami i ruchem VZTM Kielce (v0.4.5.0)
          </p>
        </div>
        <div className="flex flex-col md:items-end gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/panel/kierowca"
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
            >
              <span>🚌 Panel Kierowcy &rarr;</span>
            </Link>
            <Link
              href="/"
              className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-600 shadow"
            >
              <span>🌐 Strona Główna</span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Pracownicy: <b className="text-emerald-400">{activeUsers.length}</b>
            </span>
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Pojazdy: <b className="text-blue-400">{allVehicles.length}</b>
            </span>
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Linie: <b className="text-yellow-400">{allLines.length}</b>
            </span>
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Brygady: <b className="text-amber-400">{brigadeSchedules.length}</b>
            </span>
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Wnioski: <b className="text-purple-400">{driverRequests.length}</b>
            </span>
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Awarie: <b className="text-rose-400">{vehicleDefects.length}</b>
            </span>
          </div>
        </div>
      </div>

      {/* 1. Rekrutacja (Wnioski o konto z wiekiem i bio) */}
      {canUsers && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400 flex items-center justify-between">
            <span>👥 Oczekujące wnioski rekrutacyjne ({pendingUsers.length})</span>
          </h2>
          {pendingUsers.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak nowych wniosków rekrutacyjnych.</p>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-lg text-white flex items-center gap-2">
                      <span>Kandydat: {user.username}</span>
                      {user.age && (
                        <span className="text-xs bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-slate-300">
                          Wiek: {user.age} lat
                        </span>
                      )}
                      <span className="text-xs bg-amber-900/40 text-amber-300 border border-amber-600/40 px-2 py-0.5 rounded">
                        Numer: {user.badgeNumber || "K???"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Złożono: {new Date(user.createdAt).toLocaleString()}
                    </div>
                    {user.bio && (
                      <div className="text-xs text-slate-300 bg-slate-950 p-2 rounded border border-slate-800 mt-1 max-w-xl">
                        <b>O sobie:</b> {user.bio}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={`/api/panel/zarzad/akceptacja?userId=${user.id}&action=accept`} method="POST" className="flex items-center gap-2">
                      <select
                        name="carrier"
                        required
                        defaultValue={user.carrier || "VMPK"}
                        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white"
                      >
                        <option value="VMPK">VMPK (Czerwono-żółty)</option>
                        <option value="VBP">VBP Tour Regio (Niebieski)</option>
                      </select>
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors">
                        Zaakceptuj
                      </button>
                    </form>
                    <form action={`/api/panel/zarzad/akceptacja?userId=${user.id}&action=reject`} method="POST">
                      <button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-1.5 rounded text-sm transition-colors">
                        Odrzuć
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. Zarządzanie Pracownikami i Rolami (Wymóg 11, 12, Właściciel/Zarząd) */}
      {canUsers && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-amber-400 flex items-center justify-between">
            <span>🛡️ Zarządzanie Personelem i Rolami ({activeUsers.length})</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs text-slate-300 uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Numer</th>
                  <th className="py-3 px-4">Użytkownik</th>
                  <th className="py-3 px-4">Przewoźnik</th>
                  <th className="py-3 px-4">Rola w VZTM</th>
                  <th className="py-3 px-4">Etat / Stały wóz</th>
                  <th className="py-3 px-4 text-right">Zmień rolę</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-900/60">
                {activeUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-300">
                      {u.badgeNumber || "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{u.username}</div>
                      <div className="text-[11px] text-slate-400">Dołączył: {new Date(u.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        u.carrier === "VBP" ? "bg-blue-900/60 text-blue-300 border border-blue-600/40" : "bg-red-900/60 text-amber-300 border border-red-600/40"
                      }`}>
                        {u.carrier || "Nieprzypisany"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getRoleBadgeClass(u.role)}`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div>Etat: <b>{u.workingDays || "Brak"}</b></div>
                      <div>
                        Stały wóz:{" "}
                        {u.assignedVehicle ? (
                          <b className="text-cyan-300">#{u.assignedVehicle.fleetNumber} ({u.assignedVehicle.model})</b>
                        ) : (
                          <span className="text-slate-500">Brak</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <form action="/api/panel/zarzad/uzytkownicy" method="POST" className="inline-flex items-center gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="bg-slate-800 border border-slate-600 text-xs rounded px-2 py-1 text-white outline-none"
                        >
                          <option value="KIEROWCA">Kierowca (K)</option>
                          <option value="DYSPOZYTOR">Dyspozytor (D)</option>
                          <option value="KIEROWNIK_PRZEWOZOW">Kierownik Przewozów (P)</option>
                          <option value="MECHANIK">Mechanik (M)</option>
                          <option value="SPRAWDZAJACY">Sprawdzający (S)</option>
                          <option value="WLASCICIEL">Właściciel (W)</option>
                        </select>
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1 rounded font-semibold transition-colors"
                        >
                          Zapisz
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. Wnioski kierowców - Oczekujące i Historia (Wymóg 4, 6, 14, 15, 19) */}
      {canReqs && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4 text-amber-400 flex items-center justify-between">
              <span>📝 Oczekujące Wnioski od Kierowców ({driverRequests.length})</span>
            </h2>
            {driverRequests.length === 0 ? (
              <p className="text-slate-400 text-sm">Brak oczekujących wniosków od kierowców.</p>
            ) : (
              <div className="space-y-4">
                {driverRequests.map((req) => {
                  let vehicleInfo = null;
                  if ((req.type === "STALY_POJAZD" || req.type === "ZMIANA_STALEGO_POJAZDU") && req.details) {
                    vehicleInfo = allVehicles.find((v) => v.id === req.details);
                  }

                  return (
                    <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-white">
                            {req.user.badgeNumber ? `[${req.user.badgeNumber}] ` : ""}{req.user.username}
                          </span>
                          <span className="bg-amber-900/60 text-amber-300 border border-amber-600/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            {req.type === "URLOP"
                              ? "🏖 Wniosek o urlop"
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
                              : req.type === "ODWIESZENIE"
                              ? "🔓 Wniosek o odwieszenie konta"
                              : "❌ Anulowanie służby"}
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm"><b>Opis:</b> {req.reason}</p>
                        
                        {req.dateStart && (
                          <div className="text-xs text-slate-400">
                            <b>Termin:</b> {new Date(req.dateStart).toLocaleDateString()}
                            {req.dateEnd ? ` do ${new Date(req.dateEnd).toLocaleDateString()}` : ""}
                          </div>
                        )}

                        {vehicleInfo && (
                          <div className="text-xs text-cyan-300 font-semibold bg-cyan-950/60 p-2 rounded border border-cyan-800/40">
                            🚌 Prośba o pojazd: #{vehicleInfo.fleetNumber} {vehicleInfo.model} ({vehicleInfo.registration}) [{vehicleInfo.carrier}]
                          </div>
                        )}

                        {req.type === "ODWIESZENIE" && (
                          <div className="text-xs text-red-300 font-semibold bg-red-950/60 p-2 rounded border border-red-800/40">
                            🔓 Pracownik wnosi o odwieszenie konta (zawieszonego po 10 niezaliczonych służbach). Zaakceptowanie odblokuje kierowcę.
                          </div>
                        )}

                        {req.type === "USUNIECIE_STALEGO_POJAZDU" && (
                          <div className="text-xs text-amber-300 font-semibold bg-amber-950/60 p-2 rounded border border-amber-800/40">
                            🗑️ Pracownik prosi o usunięcie stałego pojazdu i powrót do puli rotacyjnej.
                          </div>
                        )}

                        {req.type === "ZMIANA_ETATU" && req.details && (
                          <div className="text-xs text-amber-300 font-semibold bg-amber-950/60 p-2 rounded border border-amber-800/40">
                            📅 Proponowane nowe dni pracy: {req.details}
                          </div>
                        )}

                        {req.details && !vehicleInfo && req.type !== "ZMIANA_ETATU" && req.type !== "USUNIECIE_STALEGO_POJAZDU" && req.type !== "ODWIESZENIE" && (
                          <div className="text-xs text-slate-400">Szczegóły: {req.details}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {req.type === "DODATKOWA_SLUZBA" ? (
                          <a
                            href={`/panel/zarzad?prefillDriver=${req.userId}&prefillDate=${
                              req.dateStart ? new Date(req.dateStart).toISOString().split("T")[0] : ""
                            }&prefillVehicle=${req.details || ""}&prefillReqId=${req.id}#grafik-form`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors shadow flex items-center gap-1.5"
                          >
                            <span>📅 Przydziel w grafiku &rarr;</span>
                          </a>
                        ) : (
                          <form action={`/api/panel/zarzad/wnioski?requestId=${req.id}&action=accept`} method="POST">
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors shadow cursor-pointer">
                              Zaakceptuj wniosek
                            </button>
                          </form>
                        )}
                        <details className="inline-block">
                          <summary className="bg-red-600/80 hover:bg-red-600 text-white font-medium px-3 py-1.5 rounded text-sm transition-colors shadow cursor-pointer list-none">
                            ✕ Odrzuć...
                          </summary>
                          <form
                            action={`/api/panel/zarzad/wnioski?requestId=${req.id}&action=reject`}
                            method="POST"
                            className="mt-2 p-2.5 bg-slate-950 border border-slate-700 rounded-lg space-y-2 z-10 w-64 shadow-xl"
                          >
                            <label className="block text-[11px] text-slate-300 font-semibold">
                              Powód odrzucenia wniosku:
                            </label>
                            <input
                              type="text"
                              name="rejectReason"
                              placeholder="np. Brak wolnych wozów w tym dniu"
                              required
                              className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1 text-xs text-white outline-none focus:border-red-500"
                            />
                            <button
                              type="submit"
                              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-2 rounded text-xs transition cursor-pointer"
                            >
                              Potwierdź odrzucenie
                            </button>
                          </form>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historia wniosków (Wymóg 19 i 12) */}
          <div className="border-t border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                <span>📜 Historia rozpatrzonych wniosków ({driverRequestsHistory.length})</span>
              </h3>
              {driverRequestsHistory.length > 0 && (
                <form action="/api/panel/zarzad/wnioski?action=clear_history" method="POST">
                  <button
                    type="submit"
                    className="text-xs text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-2.5 py-1 rounded transition cursor-pointer"
                  >
                    🗑️ Wyczyść historię wniosków
                  </button>
                </form>
              )}
            </div>
            {driverRequestsHistory.length === 0 ? (
              <p className="text-slate-500 text-xs">Brak historii wniosków.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {driverRequestsHistory.map((hReq) => (
                  <div key={hReq.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{hReq.user.username}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-300">
                          {hReq.type === "URLOP"
                            ? "🏖 Urlop"
                            : hReq.type === "DODATKOWA_SLUZBA"
                            ? "➕ Dodatkowa służba"
                            : hReq.type === "STALY_POJAZD"
                            ? "🚌 Stały pojazd"
                            : hReq.type === "ZMIANA_STALEGO_POJAZDU"
                            ? "🔄 Zmiana stałego pojazdu"
                            : hReq.type === "USUNIECIE_STALEGO_POJAZDU"
                            ? "🗑️ Rezygnacja ze stałego pojazdu"
                            : hReq.type === "ZMIANA_ETATU"
                            ? "📅 Zmiana etatu"
                            : hReq.type === "ODWIESZENIE"
                            ? "🔓 Odwieszenie konta"
                            : "❌ Anulowanie służby"}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          hReq.status === "ACCEPTED" ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/60 text-red-300"
                        }`}>
                          {hReq.status === "ACCEPTED" ? "ZAAKCEPTOWANY" : "ODRZUCONY"}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {hReq.reason} {hReq.details ? `(${hReq.details})` : ""}
                        {hReq.responseNotes && (
                          <span className="block text-rose-400 font-semibold mt-0.5">
                            💬 Powód zarządu: {hReq.responseNotes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-500 text-[11px]">
                        Data: {new Date(hReq.createdAt).toLocaleDateString()}
                      </span>
                      <form action={`/api/panel/zarzad/wnioski?requestId=${hReq.id}&action=delete`} method="POST">
                        <button
                          type="submit"
                          className="text-slate-500 hover:text-red-400 p-1 text-xs transition cursor-pointer"
                          title="Usuń ten wniosek z historii / anuluj urlop"
                        >
                          🗑️
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. Zgłoszenia awarii i incydentów pojazdów - Aktywne oraz Historia (Wymóg 18) */}
      {canFleet && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4 text-rose-400 flex items-center justify-between">
              <span>🚨 Aktywne Zgłoszenia Techniczne Taboru ({vehicleDefects.length})</span>
            </h2>
            {vehicleDefects.length === 0 ? (
              <p className="text-slate-400 text-sm">Brak aktywnych zgłoszeń awarii. Wszystkie pojazdy są sprawne!</p>
            ) : (
              <div className="space-y-6">
                {vehicleDefects.map((def) => (
                  <div key={def.id} className="bg-slate-900 border border-slate-700 p-5 rounded-lg space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-rose-300">{def.title}</span>
                          <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-slate-300">
                            {def.vehicle.fleetNumber} ({def.vehicle.model}) [{def.vehicle.carrier}]
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${def.status === 'WARSZTAT' ? 'bg-amber-900/60 text-amber-300' : 'bg-rose-900/60 text-rose-300'}`}>
                            Stan: {def.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Zgłosił: <b>{def.user.username}</b> &bull; {new Date(def.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Bezpośrednie szybkie przyciski decyzji (Wymóg 2) */}
                      <div className="flex flex-wrap items-center gap-2">
                        {def.status === "WARSZTAT" ? (
                          <form action={`/api/panel/zarzad/usterki?defectId=${def.id}&newStatus=NAPRAWIONE`} method="POST">
                            <button
                              type="submit"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow flex items-center gap-1.5"
                            >
                              ✅ Ustaw jako naprawione (zakończ naprawę)
                            </button>
                          </form>
                        ) : (
                          <>
                            <form action={`/api/panel/zarzad/usterki?defectId=${def.id}&newStatus=WARSZTAT`} method="POST">
                              <button
                                type="submit"
                                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-3 py-1 rounded text-xs transition-colors shadow"
                              >
                                🛠 Skieruj na warsztat
                              </button>
                            </form>
                            <form action={`/api/panel/zarzad/usterki?defectId=${def.id}&newStatus=NAPRAWIONE`} method="POST">
                              <button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded text-xs transition-colors shadow"
                              >
                                ✅ Ustaw naprawione
                              </button>
                            </form>
                            <form action={`/api/panel/zarzad/usterki?defectId=${def.id}&newStatus=ODRZUCONE`} method="POST">
                              <button
                                type="submit"
                                className="bg-red-600/80 hover:bg-red-600 text-white font-semibold px-3 py-1 rounded text-xs transition-colors shadow"
                              >
                                ❌ Odrzuć
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800 space-y-2">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block mb-1">Opis usterki od kierowcy:</span>
                        <p className="whitespace-pre-wrap">{def.description || "Brak szczegółowego opisu."}</p>
                      </div>

                      {/* Galeria zdjęć awarii ze zgłoszenia (Wymóg 6) */}
                      {def.photos && (() => {
                        try {
                          const pList = JSON.parse(def.photos) as string[];
                          if (Array.isArray(pList) && pList.length > 0) {
                            return (
                              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                                <span className="text-xs text-amber-300 font-semibold block">
                                  📷 Dołączone zdjęcia uszkodzeń ({pList.length}):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {pList.map((photoUrl, pIdx) => (
                                    <a
                                      key={pIdx}
                                      href={photoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Kliknij, aby otworzyć zdjęcie w pełnym rozmiarze"
                                      className="group relative block overflow-hidden rounded-lg border border-slate-700 hover:border-amber-400 transition"
                                    >
                                      <img
                                        src={photoUrl}
                                        alt={`Zdjęcie usterki ${pIdx + 1}`}
                                        className="w-24 h-24 object-cover group-hover:scale-105 transition-transform"
                                      />
                                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-white py-0.5">
                                        Powiększ ↗
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch {}
                        return null;
                      })()}
                    </div>

                    {/* Formularz zarządzania warsztatem */}
                    <form action={`/api/panel/zarzad/usterki?defectId=${def.id}`} method="POST" className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                        ⚙️ Decyzja Działu Technicznego / Warsztatu:
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Rodzaj usterki / awarii</label>
                          <input
                            type="text"
                            name="defectType"
                            defaultValue={def.defectType || def.title}
                            placeholder="np. Układ hamulcowy, Drzwi, Silnik"
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Na warsztacie od</label>
                          <input
                            type="date"
                            name="workshopStart"
                            defaultValue={def.workshopStart ? new Date(def.workshopStart).toISOString().split('T')[0] : ""}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Przewidywany powrót do</label>
                          <input
                            type="date"
                            name="workshopEnd"
                            defaultValue={def.workshopEnd ? new Date(def.workshopEnd).toISOString().split('T')[0] : ""}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Notatki z naprawy / komentarz</label>
                        <input
                          type="text"
                          name="adminNotes"
                          defaultValue={def.adminNotes || ""}
                          placeholder="np. Wymiana klocków, pojazd gotowy do jazdy"
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="submit"
                          name="status"
                          value="WARSZTAT"
                          className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          🛠 Skieruj / Zapisz jako WARSZTAT
                        </button>
                        <button
                          type="submit"
                          name="status"
                          value="NAPRAWIONE"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          ✅ Oznacz jako NAPRAWIONE (Zapisz do historii)
                        </button>
                        <button
                          type="submit"
                          name="status"
                          value="ODRZUCONE"
                          className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors"
                        >
                          ❌ Odrzuć zgłoszenie (Zapisz do historii)
                        </button>
                      </div>
                    </form>

                    {/* Przypisanie wozu zastępczego powiązane ze zgłoszeniem awarii (Wymóg 6) */}
                    {canReplaceVeh && (() => {
                      const affectedDuties = allDuties.filter(
                        (d) => (d.userId === def.userId || d.vehicleId === def.vehicleId) && d.status === "SCHEDULED"
                      );
                      return (
                        <div className="bg-slate-950/70 p-3.5 rounded-lg border border-purple-900/60 space-y-2">
                          <div className="text-xs font-bold text-purple-300 flex items-center justify-between">
                            <span>🔄 Wyznacz wóz zastępczy na trasę (dla kierowcy ze zgłoszoną awarią)</span>
                            <span className="text-[10px] text-slate-400">Aktywne zaplanowane służby: {affectedDuties.length}</span>
                          </div>
                          {affectedDuties.length === 0 ? (
                            <p className="text-[11px] text-slate-400">Kierowca lub pojazd nie ma obecnie aktywnych zaplanowanych służb w grafiku.</p>
                          ) : (
                            <div className="space-y-2">
                              {affectedDuties.map((d) => (
                                <form
                                  key={d.id}
                                  action="/api/panel/zarzad/woz-zastepczy"
                                  method="POST"
                                  className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2.5 rounded border border-slate-800 text-xs"
                                >
                                  <input type="hidden" name="dutyId" value={d.id} />
                                  <span className="font-semibold text-white">Linia {d.line.number} (Brygada: {d.brigade || "b/d"}):</span>
                                  <span className="text-slate-400">Wóz pierwotny: #{d.vehicle?.fleetNumber}</span>
                                  {d.replacementVehicle && (
                                    <span className="bg-purple-900/60 text-purple-200 border border-purple-500/50 px-1.5 py-0.5 rounded font-bold">
                                      Aktualny zastępczy: #{d.replacementVehicle.fleetNumber}
                                    </span>
                                  )}
                                  <select
                                    name="replacementVehicleId"
                                    defaultValue={d.replacementVehicleId || ""}
                                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-white outline-none focus:border-purple-500"
                                  >
                                    <option value="">-- Brak (Wycofaj wóz zastępczy) --</option>
                                    {allVehicles
                                      .filter((v) => v.id !== d.vehicleId && (!d.user?.carrier || v.carrier === d.user.carrier))
                                      .map((v) => (
                                        <option key={v.id} value={v.id}>
                                          #{v.fleetNumber} {v.model} ({v.registration}) [{v.carrier}]
                                        </option>
                                      ))}
                                  </select>
                                  <input
                                    type="text"
                                    name="reason"
                                    placeholder="Powód podmiany"
                                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-white outline-none focus:border-purple-500"
                                  />
                                  <button
                                    type="submit"
                                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1 rounded text-xs transition-colors shadow cursor-pointer whitespace-nowrap"
                                  >
                                    🔄 Zatwierdź wóz zastępczy
                                  </button>
                                </form>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historia zgłoszeń technicznych (Wymóg 18 i 12) */}
          <div className="border-t border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                <span>📜 Historia napraw i odrzuconych zgłoszeń technicznych ({vehicleDefectsHistory.length})</span>
              </h3>
              {vehicleDefectsHistory.length > 0 && (
                <form action="/api/panel/zarzad/usterki?action=clear_history" method="POST">
                  <button
                    type="submit"
                    className="text-xs text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-2.5 py-1 rounded transition cursor-pointer"
                  >
                    🗑️ Wyczyść historię warsztatu
                  </button>
                </form>
              )}
            </div>
            {vehicleDefectsHistory.length === 0 ? (
              <p className="text-slate-500 text-xs">Brak wpisów w historii warsztatu.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {vehicleDefectsHistory.map((hDef) => (
                  <div key={hDef.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">#{hDef.vehicle.fleetNumber} ({hDef.vehicle.model})</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-300">{hDef.title}</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          hDef.status === "NAPRAWIONE" ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/60 text-red-300"
                        }`}>
                          {hDef.status === "NAPRAWIONE" ? "NAPRAWIONE" : "ODRZUCONE"}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {hDef.adminNotes ? `Notatka: ${hDef.adminNotes}` : `Zgłosił: ${hDef.user.username}`}
                      </div>
                    </div>
                    <div className="text-slate-500 text-[11px] shrink-0">
                      Data zgłoszenia: {new Date(hDef.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5. Raporty z tras */}
      {canReqs && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-blue-400">
            📋 Oczekujące Raporty z Tras ({pendingReports.length})
          </h2>
          {pendingReports.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak raportów do rozpatrzenia.</p>
          ) : (
            <div className="space-y-4">
              {pendingReports.map((report) => (
                <div key={report.id} className="bg-slate-900 border border-slate-700 p-5 rounded-lg">
                  <div className="flex flex-wrap justify-between items-center border-b border-slate-700 pb-2 mb-3">
                    <span className="font-bold text-lg text-white">
                      Kierowca: {report.duty.user.username} (Linia {report.duty.line.number}{report.duty.brigade ? ` • Brygada: ${report.duty.brigade}` : ""}{report.duty.vehicle ? ` • 🚌 #${report.duty.vehicle.fleetNumber}` : ""})
                    </span>
                    <span className="text-xs text-slate-400">
                      Data służby: {new Date(report.duty.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                    <div>Stan początkowy: <b className="text-slate-200">{report.startMileage} km</b></div>
                    <div>Stan końcowy: <b className="text-slate-200">{report.endMileage} km</b></div>
                    <div>Dystans z kursu: <b className="text-emerald-400 font-bold">+{Math.max(0, report.endMileage - report.startMileage)} km</b></div>
                    <div>
                      {report.duty.vehicle ? (
                        <span className="text-cyan-300 text-xs">
                          Licznik #{report.duty.vehicle.fleetNumber}: <b>{report.duty.vehicle.mileage} km</b>
                          <span className="text-emerald-400 block text-[11px] font-semibold">
                            ➔ po akceptacji: {report.duty.vehicle.mileage + Math.max(0, report.endMileage - report.startMileage)} km
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-400 text-xs">Brak przypisanego pojazdu</span>
                      )}
                    </div>
                  </div>

                  {/* Podgląd plików i screenów (Wymóg 10) */}
                  <div className="mb-4">
                    <ReportFileList
                      reportId={report.id}
                      startScreenshot={report.startScreenshot}
                      endScreenshot={report.endScreenshot}
                      summaryFile={report.summaryFile}
                      depotScreenshots={report.depotScreenshots}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                    <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=accept`} method="POST">
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-semibold transition-colors flex items-center gap-1.5 shadow">
                        ✅ Akceptuj Raport (+{Math.max(0, report.endMileage - report.startMileage)} km do licznika)
                      </button>
                    </form>
                    <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=reject`} method="POST">
                      <button type="submit" className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">
                        ✕ Odrzuć Raport
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 6. Wiadomości kontaktowe */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <span>📬 Skrzynka Wiadomości Kontaktowych ({contactMessages.length})</span>
          </h2>
          {contactMessages.length > 0 && (
            <form action="/api/panel/zarzad/wiadomosci?action=clear_contact_history" method="POST">
              <button
                type="submit"
                className="text-xs text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-2.5 py-1 rounded transition cursor-pointer"
              >
                🗑️ Wyczyść skrzynkę kontaktową
              </button>
            </form>
          )}
        </div>
        {contactMessages.length === 0 ? (
          <p className="text-slate-400 text-sm">Brak nadesłanych wiadomości.</p>
        ) : (
          <div className="space-y-4 max-h-[32rem] overflow-y-auto">
            {contactMessages.map((msg) => (
              <div key={msg.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg space-y-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{msg.subject}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        msg.status === 'ODPOWIEDZIANO' ? 'bg-emerald-900/60 text-emerald-300' :
                        msg.status === 'NOWA' ? 'bg-purple-900/60 text-purple-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {msg.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Od: <b>{msg.name}</b> ({msg.email}) &bull; {new Date(msg.createdAt).toLocaleString()}
                    </div>
                    <p className="text-slate-300 text-sm mt-1 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <form action={`/api/panel/zarzad/wiadomosci?id=${msg.id}&action=delete`} method="POST">
                      <button type="submit" className="bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs cursor-pointer">
                        Usuń
                      </button>
                    </form>
                  </div>
                </div>

                {msg.reply && (
                  <div className="bg-slate-950/80 p-3 rounded border border-purple-800/40 text-xs space-y-1">
                    <span className="font-bold text-purple-300 block">Odpowiedź Zarządu ({msg.repliedAt ? new Date(msg.repliedAt).toLocaleString() : ""}):</span>
                    <p className="text-slate-200 whitespace-pre-wrap">{msg.reply}</p>
                  </div>
                )}

                <form action={`/api/panel/zarzad/wiadomosci?id=${msg.id}&action=reply`} method="POST" className="flex gap-2 items-center pt-1 border-t border-slate-800">
                  <input
                    type="text"
                    name="reply"
                    required
                    placeholder="Wpisz odpowiedź na tę wiadomość..."
                    className="flex-grow bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                  <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer">
                    💬 Wyślij odpowiedź
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6.5. Komunikacja i Wiadomości z Kierowcami (Wymogi 3, 9, 9.1) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md space-y-6" id="wiadomosci">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-sky-400">
              <span>📨 Komunikacja z Kierowcami i Dyspozycje</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Wysyłaj wiadomości do pracowników, odbieraj ich zapytania i odpowiadaj na nie w czasie rzeczywistym.
            </p>
          </div>
          {receivedDriverMessages.filter((m) => !m.reply).length > 0 && (
            <span className="bg-sky-500 text-white font-bold text-xs px-2.5 py-1 rounded-full animate-pulse self-start sm:self-auto">
              Oczekujące zapytania: {receivedDriverMessages.filter((m) => !m.reply).length}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Lewa kolumna: Formularz wysyłki nowej wiadomości do kierowcy + Historia wysłanych */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-sky-300">✉️ Nowa wiadomość / dyspozycja do kierowcy</h3>
            <form action="/api/panel/zarzad/wiadomosci/kierowca" method="POST" className="bg-slate-900/90 p-5 rounded-xl border border-slate-700 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Wybierz odbiorcę (kierowcę) *
                  </label>
                  <select
                    name="userId"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                  >
                    <option value="">-- Wybierz pracownika --</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.badgeNumber ? `[${u.badgeNumber}] ` : ""}{u.username} [{u.carrier || "Brak"}] ({getRoleLabel(u.role)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tytuł wiadomości *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="np. Informacja o zmianie trasy, Podmiana wozu, Wezwanie"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Treść wiadomości / dyspozycji *
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={3}
                    placeholder="Wpisz treść dyspozycji lub wiadomości dla kierowcy..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 resize-none"
                  ></textarea>
                </div>
              </div>

              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition-colors shadow flex items-center gap-2 cursor-pointer"
              >
                <span>✉️ Wyślij wiadomość do kierowcy</span>
              </button>
            </form>

            {/* Historia wysłanych wiadomości do kierowców (Wymóg 12) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  📤 Historia wiadomości wysłanych do Kierowców ({sentDriverMessages.length}):
                </h4>
                {sentDriverMessages.length > 0 && (
                  <form action="/api/panel/zarzad/wiadomosci?action=clear_driver_notifications" method="POST">
                    <button
                      type="submit"
                      className="text-[11px] text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      🗑️ Wyczyść historię
                    </button>
                  </form>
                )}
              </div>
              {sentDriverMessages.length === 0 ? (
                <p className="text-slate-500 text-xs">Brak wysłanych wiadomości.</p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {sentDriverMessages.map((msg) => (
                    <div key={msg.id} className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-white">{msg.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(msg.createdAt).toLocaleString("pl-PL")}
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-300">
                        Do: <b>{msg.user?.username}</b> {msg.user?.badgeNumber ? `[${msg.user.badgeNumber}]` : ""} &bull; Nadawca: {msg.sender}
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                      {msg.reply && (
                        <div className="bg-emerald-950/70 border border-emerald-700/60 p-2 rounded text-emerald-200 mt-1 space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                            <span>💬 Odpowiedź kierowcy ({msg.replyBy || msg.user?.username}):</span>
                            {msg.repliedAt && (
                              <span className="text-[10px] text-slate-400 font-mono font-normal">
                                {new Date(msg.repliedAt).toLocaleString("pl-PL")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white whitespace-pre-wrap">{msg.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prawa kolumna: Odebrane wiadomości od Kierowców (z możliwością odpowiedzi) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-amber-300 flex items-center justify-between">
              <span>📥 Wiadomości i Zapytania od Kierowców ({receivedDriverMessages.length})</span>
            </h3>

            {receivedDriverMessages.length === 0 ? (
              <p className="text-slate-400 text-xs bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                Brak wiadomości nadesłanych przez kierowców.
              </p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {receivedDriverMessages.map((msg) => (
                  <div key={msg.id} className="bg-slate-900/90 border border-slate-700 p-4 rounded-xl text-xs space-y-2.5 shadow">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{msg.title}</span>
                        <span className="bg-amber-950 text-amber-300 border border-amber-600/50 px-2 py-0.5 rounded font-mono text-[10px]">
                          {msg.user?.username} {msg.user?.badgeNumber ? `[${msg.user.badgeNumber}]` : ""}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(msg.createdAt).toLocaleString("pl-PL")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {msg.message}
                    </p>

                    {msg.reply ? (
                      <div className="bg-sky-950/70 border border-sky-700/60 p-2.5 rounded-lg text-sky-200 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-sky-300">
                          <span>💬 Twoja odpowiedź ({msg.replyBy || "Zarząd"}):</span>
                          {msg.repliedAt && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              {new Date(msg.repliedAt).toLocaleString("pl-PL")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white whitespace-pre-wrap">{msg.reply}</p>
                      </div>
                    ) : (
                      <form action="/api/panel/zarzad/wiadomosci/odpowiedz" method="POST" className="pt-2 border-t border-slate-800 flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <input type="hidden" name="notificationId" value={msg.id} />
                        <input
                          type="text"
                          name="replyText"
                          required
                          placeholder="Wpisz odpowiedź na zapytanie kierowcy..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors shadow"
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
        </div>
      </section>

      {/* 7. Zarządzanie Liniami i Taborem */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Zarządzanie Liniami */}
        {canLines && (
          <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">Zarządzanie Liniami</h2>
            
            {/* Dodaj nową linię */}
            <form action="/api/panel/zarzad/linie" method="POST" className="space-y-3 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h3 className="font-semibold text-white text-sm">➕ Dodaj Nową Linię</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Numer linii *</label>
                  <input type="text" name="number" placeholder="np. 34" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dedykowany przewoźnik</label>
                  <select name="carrier" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white">
                    <option value="">Wszyscy / Dowolny</option>
                    <option value="VMPK">VMPK</option>
                    <option value="VBP">VBP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kierunki trasy / warianty</label>
                  <input type="text" name="directions" placeholder="np. A: Bukówka, B: Wichrowa" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Dostępne brygady</label>
                  <input type="text" name="brigades" placeholder="np. 1, 2, 3, 4" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Przystanek startowy (opcjonalnie)</label>
                  <input type="text" name="startStop" placeholder="np. Bukówka" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Przystanek końcowy (opcjonalnie)</label>
                  <input type="text" name="endStop" placeholder="np. Wichrowa" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors shadow">
                Zapisz nową linię
              </button>
            </form>

            {/* Lista linii */}
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Zdefiniowane linie ({allLines.length}):</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allLines.map((line) => (
                <div key={line.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-sm space-y-2">
                  <form action="/api/panel/zarzad/linie/edit" method="POST" className="space-y-2">
                    <input type="hidden" name="id" value={line.id} />
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Numer linii:</label>
                        <input type="text" name="number" defaultValue={line.number} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Numer linii" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Przewoźnik:</label>
                        <select name="carrier" defaultValue={line.carrier || ""} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                          <option value="">Dowolny</option>
                          <option value="VMPK">VMPK</option>
                          <option value="VBP">VBP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Kierunki trasy:</label>
                        <input type="text" name="directions" defaultValue={line.directions || ""} placeholder="Kierunki" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Brygady:</label>
                        <input type="text" name="brigades" defaultValue={line.brigades || ""} placeholder="np. 1, 2" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-semibold">
                        Zapisz zmiany
                      </button>
                      <button
                        type="submit"
                        formAction={`/api/panel/zarzad/linie/delete?id=${line.id}`}
                        className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-semibold"
                      >
                        🗑 Usuń linię
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Zarządzanie Taborem */}
        {canFleet && (
          <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">Zarządzanie Taborem</h2>
            
            {/* Dodaj pojazd */}
            <form action="/api/panel/zarzad/tabor" method="POST" encType="multipart/form-data" className="space-y-3 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
              <h3 className="font-semibold text-white text-sm">➕ Dodaj Nowy Pojazd</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Przewoźnik *</label>
                  <select name="carrier" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white">
                    <option value="">Wybierz przewoźnika</option>
                    <option value="VMPK">VMPK</option>
                    <option value="VBP">VBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Numer taborowy *</label>
                  <input type="text" name="fleetNumber" placeholder="np. #103" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Model pojazdu *</label>
                  <input type="text" name="model" placeholder="np. Solaris Urbino 12" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Numer rejestracyjny *</label>
                  <input type="text" name="registration" placeholder="np. TK 99999" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Początkowy stan licznika [km]</label>
                  <input type="number" name="mileage" placeholder="np. 145000" defaultValue="0" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status techniczny</label>
                  <select name="status" defaultValue="SPRAWNY" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white">
                    <option value="SPRAWNY">Sprawny</option>
                    <option value="WARSZTAT">Warsztat</option>
                    <option value="KASACJA">Wyłączony / Kasacja</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">📷 Zdjęcie pojazdu [JPG, PNG, WEBP]</label>
                <input
                  type="file"
                  name="image"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-emerald-700 file:text-white"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors shadow">
                Zapisz pojazd do floty
              </button>
            </form>

            {/* Lista pojazdów */}
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Pojazdy w bazie ({allVehicles.length}):</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {allVehicles.map((veh) => (
                <div key={veh.id} className="bg-slate-900 p-3.5 rounded-lg border border-slate-700 text-sm space-y-2">
                  <form action="/api/panel/zarzad/tabor/edit" method="POST" encType="multipart/form-data" className="space-y-2">
                    <input type="hidden" name="id" value={veh.id} />
                    
                    {veh.imageUrl && (
                      <div className="flex items-center gap-3 bg-slate-950 p-2 rounded border border-slate-800">
                        <img src={veh.imageUrl} alt={veh.fleetNumber} className="h-12 w-20 object-cover rounded" />
                        <span className="text-xs text-slate-400">Aktualne zdjęcie przypisane</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Przewoźnik:</label>
                        <select name="carrier" defaultValue={veh.carrier} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                          <option value="VMPK">VMPK</option>
                          <option value="VBP">VBP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Nr taborowy:</label>
                        <input type="text" name="fleetNumber" defaultValue={veh.fleetNumber} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Nr taborowy" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Status:</label>
                        <select name="status" defaultValue={veh.status} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                          <option value="SPRAWNY">Sprawny</option>
                          <option value="WARSZTAT">Warsztat</option>
                          <option value="KASACJA">Kasacja</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Model pojazdu:</label>
                        <input type="text" name="model" defaultValue={veh.model} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Model" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Rejestracja:</label>
                        <input type="text" name="registration" defaultValue={veh.registration} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Rejestracja" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Stan licznika [km]:</label>
                        <input type="number" name="mileage" defaultValue={veh.mileage || 0} placeholder="Przebieg [km]" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Przebieg pojazdu [km]" />
                      </div>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-mono">
                      Aktualny przebieg: <b>{(veh.mileage || 0).toLocaleString()} km</b>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-0.5">Zmień / wgraj nowe zdjęcie pojazdu:</label>
                      <input
                        type="file"
                        name="image"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-blue-700 file:text-white"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1 gap-2 flex-wrap">
                      <div className="flex gap-2 items-center">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-semibold">
                          Zapisz zmiany
                        </button>
                        {veh.status === "WARSZTAT" && (
                          <button
                            type="submit"
                            formAction={`/api/panel/zarzad/tabor/status?id=${veh.id}&status=SPRAWNY`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold shadow flex items-center gap-1 cursor-pointer"
                          >
                            ✅ Zmień na Sprawny
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        formAction={`/api/panel/zarzad/tabor/delete?id=${veh.id}`}
                        className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-semibold"
                      >
                        🗑 Usuń pojazd
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 8. Zarządzanie Wykazem Brygad (Wymóg 17: Godzina Wyjazdu, Zjazdu, 1. i ostatniego przystanku) */}
      {canLines && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-amber-400">📋 Wykaz Brygad (Harmonogram, Godziny Wyjazdu i Zjazdu)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Wprowadzaj godziny wyjazdu, zjazdu oraz odjazdów z pierwszego i ostatniego przystanku.</p>
            </div>
            <a href="/brygady" target="_blank" className="text-xs text-amber-400 hover:underline">
              Zobacz publiczny widok brygad &rarr;
            </a>
          </div>

          {/* Formularz dodawania brygady (Wymóg 5 i 10) */}
          <BrigadeCreationForm lines={allLines} />

          {/* Lista brygad */}
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Wpisy w wykazie ({brigadeSchedules.length}):</h3>
          {brigadeSchedules.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak zdefiniowanych brygad w wykazie.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {brigadeSchedules.map((b) => (
                <BrigadeEditCard key={b.id} brigade={b} lines={allLines} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 9. Przydzielanie i usuwanie Służb (Grafik) */}
      {canDuties && (
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-emerald-400">Wydawanie i Zarządzanie Służbami (Grafik)</h2>
          
          {/* Formularz wydawania służby (Wymogi 3, 4, 7, 8) */}
          <DutyAssignmentForm
            users={activeUsers.map((u) => ({
              id: u.id,
              username: u.username,
              badgeNumber: u.badgeNumber,
              carrier: u.carrier,
              assignedVehicle: u.assignedVehicle
                ? { id: u.assignedVehicle.id, fleetNumber: u.assignedVehicle.fleetNumber }
                : null,
            }))}
            lines={allLines.map((l) => ({
              id: l.id,
              number: l.number,
              carrier: l.carrier,
              directions: l.directions,
              startStop: l.startStop,
              endStop: l.endStop,
            }))}
            vehicles={allVehicles.map((v) => ({
              id: v.id,
              fleetNumber: v.fleetNumber,
              model: v.model,
              carrier: v.carrier,
              mileage: v.mileage,
            }))}
            brigades={brigadeSchedules.map((b) => ({
              id: b.id,
              lineId: b.lineId,
              brigadeNumber: b.brigadeNumber,
              carrier: b.carrier,
              brigadeType: b.brigadeType,
              startTime: b.startTime,
              endTime: b.endTime,
              startTime2: b.startTime2,
              endTime2: b.endTime2,
              line: { number: b.line?.number || "", carrier: b.line?.carrier || null },
            }))}
            prefill={{
              driverId: prefillDriver,
              date: prefillDate,
              vehicleId: prefillVehicle,
              requestId: prefillReqId,
            }}
          />

          {/* Lista służb */}
          <h3 className="text-sm font-semibold text-slate-400 mb-3">Aktualny grafik służb ({allDuties.length}):</h3>
          {allDuties.length === 0 ? (
            <p className="text-slate-400 text-sm">Brak przypisanych służb w systemie.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allDuties.map((duty) => (
                <div key={duty.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-base">Linia {duty.line.number}</span>
                      {duty.brigade && (
                        <span className="bg-amber-900/50 text-amber-300 border border-amber-600/40 text-xs px-2 py-0.5 rounded font-mono font-bold">
                          Brygada: {duty.brigade}
                        </span>
                      )}
                      {duty.vehicle && (
                        <span className="bg-blue-900/50 text-blue-300 border border-blue-600/40 text-xs px-2 py-0.5 rounded font-bold">
                          🚌 {duty.vehicle.fleetNumber} ({duty.vehicle.model}) &bull; {(duty.vehicle.mileage || 0).toLocaleString()} km
                        </span>
                      )}
                      {duty.replacementVehicle && (
                        <span className="bg-purple-900/60 text-purple-300 border border-purple-500/50 text-xs px-2 py-0.5 rounded font-bold">
                          🔄 Wóz zastępczy: #{duty.replacementVehicle.fleetNumber} ({duty.replacementVehicle.model})
                        </span>
                      )}
                      <span className="text-slate-400">&bull;</span>
                      <span className="font-semibold text-emerald-400">
                        {duty.user.badgeNumber ? `[${duty.user.badgeNumber}] ` : ""}{duty.user.username} ({duty.user.carrier})
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${duty.status === 'SCHEDULED' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                        {duty.status === 'SCHEDULED' ? 'Zaplanowana' : 'Zrealizowana'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Data służby: {new Date(duty.date).toLocaleDateString("pl-PL")}
                    </div>
                    {duty.notes && (
                      <div className="mt-1.5 text-xs text-amber-300">
                        ℹ️ <b>Uwagi:</b> {duty.notes}
                      </div>
                    )}
                    {canReplaceVeh && (() => {
                      const hasActiveDefect = vehicleDefects.some(
                        (vd) => vd.vehicleId === duty.vehicleId || vd.userId === duty.userId
                      );
                      const showReplacementOption = Boolean(duty.replacementVehicleId) || hasActiveDefect;
                      if (!showReplacementOption) return null;

                      return (
                        <details className="mt-2 text-xs bg-slate-950/70 p-2.5 rounded border border-purple-900/60">
                          <summary className="cursor-pointer text-purple-400 font-bold hover:underline flex items-center gap-1.5">
                            <span>🔄 {duty.replacementVehicle ? "Zmień / Wycofaj wóz zastępczy" : "Wyznacz wóz zastępczy (zgłoszona awaria)"}</span>
                            {hasActiveDefect && (
                              <span className="bg-rose-950 text-rose-300 border border-rose-600 px-1.5 py-0.2 rounded text-[10px]">
                                🚨 Zgłoszona awaria
                              </span>
                            )}
                          </summary>
                          <form action="/api/panel/zarzad/woz-zastepczy" method="POST" className="mt-2 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="dutyId" value={duty.id} />
                            <select
                              name="replacementVehicleId"
                              defaultValue={duty.replacementVehicleId || ""}
                              className="bg-slate-900 border border-slate-700 text-xs rounded px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
                            >
                              <option value="">-- Brak (Wycofaj wóz zastępczy) --</option>
                              {allVehicles
                                .filter((v) => !duty.user?.carrier || v.carrier === duty.user.carrier)
                                .map((v) => (
                                  <option key={v.id} value={v.id}>
                                    #{v.fleetNumber} {v.model} ({v.registration}) [{v.carrier}]
                                  </option>
                                ))}
                            </select>
                            <input
                              type="text"
                              name="reason"
                              placeholder="Powód podmiany (np. awaria drzwi)"
                              className="bg-slate-900 border border-slate-700 text-xs rounded px-2.5 py-1.5 text-white outline-none focus:border-purple-500"
                            />
                            <button
                              type="submit"
                              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded text-xs transition-colors shadow cursor-pointer"
                            >
                              Zatwierdź wóz zastępczy
                            </button>
                          </form>
                        </details>
                      );
                    })()}
                    {/* Formularz edycji służby (Wymóg 7) */}
                    <details className="mt-2 text-xs bg-slate-950/80 p-3 rounded-lg border border-slate-700 space-y-2">
                      <summary className="cursor-pointer font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 list-none">
                        <span>✏️ Edytuj tę służbę w grafiku</span>
                      </summary>
                      <form action="/api/panel/zarzad/sluzby/edit" method="POST" className="mt-2 space-y-3 pt-2 border-t border-slate-800">
                        <input type="hidden" name="dutyId" value={duty.id} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Kierowca:</label>
                            <select
                              name="userId"
                              defaultValue={duty.userId}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            >
                              {activeUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.badgeNumber ? `[${u.badgeNumber}] ` : ""}{u.username} [{u.carrier || "Brak"}]
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Linia:</label>
                            <select
                              name="lineId"
                              defaultValue={duty.lineId}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            >
                              {allLines.map((l) => (
                                <option key={l.id} value={l.id}>
                                  Linia {l.number} {l.carrier ? `[${l.carrier}]` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Pojazd:</label>
                            <select
                              name="vehicleId"
                              defaultValue={duty.vehicleId || ""}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            >
                              <option value="">-- Brak wozu --</option>
                              {allVehicles
                                .filter((v) => !duty.user?.carrier || v.carrier === duty.user.carrier)
                                .map((v) => (
                                  <option key={v.id} value={v.id}>
                                    #{v.fleetNumber} {v.model} [{v.carrier}]
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Data służby:</label>
                            <input
                              type="date"
                              name="date"
                              defaultValue={new Date(duty.date).toISOString().split("T")[0]}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Brygada:</label>
                            <input
                              type="text"
                              name="brigade"
                              defaultValue={duty.brigade || ""}
                              placeholder="np. 2/1 - Dni robocze"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Zmiana:</label>
                            <select
                              name="shift"
                              defaultValue={duty.shift || "1 Zmiana"}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            >
                              <option value="1 Zmiana">1 Zmiana</option>
                              <option value="2 Zmiana">2 Zmiana</option>
                              <option value="3 Zmiana">3 Zmiana</option>
                              <option value="Szczytowa">Szczytowa</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">Status:</label>
                            <select
                              name="status"
                              defaultValue={duty.status}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                            >
                              <option value="SCHEDULED">Zaplanowana (SCHEDULED)</option>
                              <option value="COMPLETED">Zrealizowana (COMPLETED)</option>
                              <option value="CANCELLED">Anulowana (CANCELLED)</option>
                              <option value="MISSED">Niezaliczona (MISSED)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Uwagi:</label>
                          <input
                            type="text"
                            name="notes"
                            defaultValue={duty.notes || ""}
                            placeholder="Opcjonalne uwagi..."
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer"
                          >
                            💾 Zapisz zmiany w służbie
                          </button>
                        </div>
                      </form>
                    </details>
                  </div>
                  <div className="shrink-0">
                    <form action={`/api/panel/zarzad/sluzby/delete?id=${duty.id}`} method="POST">
                      <button type="submit" className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer">
                        🗑 Usuń służbę
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
