import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ZARZAD") {
    redirect("/");
  }

  const [
    pendingUsers,
    allLines,
    allVehicles,
    activeUsers,
    pendingReports,
    allDuties,
    driverRequests,
    vehicleDefects,
    contactMessages,
    brigadeSchedules,
  ] = await Promise.all([
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
      orderBy: { username: "asc" },
    }),
    prisma.report.findMany({
      where: { status: "PENDING" },
      include: {
        duty: {
          include: {
            user: true,
            line: true,
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
        report: true,
      },
      orderBy: { date: "desc" },
      take: 40,
    }),
    prisma.driverRequest.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicleDefect.findMany({
      where: { status: { in: ["NOWE", "WARSZTAT"] } },
      include: { user: true, vehicle: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.brigadeSchedule.findMany({
      include: { line: true },
      orderBy: [{ line: { number: "asc" } }, { brigadeNumber: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-12">
      {/* Nagłówek i statystyki */}
      <div className="border-b border-slate-700 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-amber-400">Panel Główny Zarządu</h1>
          <p className="text-slate-400 mt-1">
            Zarządzanie personelem, taborem, liniami, brygadami i zgłoszeniami VZTM Kielce
          </p>
        </div>
        <div className="flex flex-col md:items-end gap-3">
          <Link
            href="/"
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 border border-slate-600 self-start md:self-auto"
          >
            <span>🌐 Przejdź do strony publicznej &rarr;</span>
          </Link>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              Kierowcy: <b className="text-emerald-400">{activeUsers.length}</b>
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
              Awarie: <b className="text-rose-400">{vehicleDefects.length}</b>
            </span>
          </div>
        </div>
      </div>

      {/* 1. Rekrutacja (Wnioski o konto) */}
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
                <div>
                  <div className="font-bold text-lg text-white">Kandydat: {user.username}</div>
                  <div className="text-xs text-slate-400">Złożono: {new Date(user.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={`/api/panel/zarzad/akceptacja?userId=${user.id}&action=accept`} method="POST" className="flex items-center gap-2">
                    <select
                      name="carrier"
                      required
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white"
                    >
                      <option value="">Wybierz przewoźnika</option>
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

      {/* 2. Wnioski kierowców (Urlopy, Dodatkowe służby, Anulowania) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-amber-400 flex items-center justify-between">
          <span>📝 Wnioski od Kierowców ({driverRequests.length})</span>
        </h2>
        {driverRequests.length === 0 ? (
          <p className="text-slate-400 text-sm">Brak oczekujących wniosków od kierowców.</p>
        ) : (
          <div className="space-y-4">
            {driverRequests.map((req) => (
              <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-white">{req.user.username}</span>
                    <span className="bg-amber-900/60 text-amber-300 border border-amber-600/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {req.type === "URLOP" ? "🏖 Wniosek o urlop" : req.type === "DODATKOWA_SLUZBA" ? "➕ Dodatkowa służba" : "❌ Anulowanie służby"}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm"><b>Powód:</b> {req.reason}</p>
                  {req.dateStart && (
                    <div className="text-xs text-slate-400">
                      Termin: {new Date(req.dateStart).toLocaleDateString()}
                      {req.dateEnd ? ` do ${new Date(req.dateEnd).toLocaleDateString()}` : ""}
                    </div>
                  )}
                  {req.details && <div className="text-xs text-slate-400">Szczegóły: {req.details}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={`/api/panel/zarzad/wnioski?requestId=${req.id}&action=accept`} method="POST">
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors">
                      Zaakceptuj wniosek
                    </button>
                  </form>
                  <form action={`/api/panel/zarzad/wnioski?requestId=${req.id}&action=reject`} method="POST">
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

      {/* 3. Zgłoszenia awarii i incydentów pojazdów z datami warsztatu */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-rose-400 flex items-center justify-between">
          <span>🚨 Zgłoszenia Techniczne Taboru (Awarie i Warsztat) ({vehicleDefects.length})</span>
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
                </div>

                <div className="text-sm text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Opis kierowcy:</span>
                  {def.description}
                </div>

                {/* Formularz zarządzania warsztatem dla admina */}
                <form action={`/api/panel/zarzad/usterki?defectId=${def.id}`} method="POST" className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    ⚙️ Ustalenia Warsztatowe (Zarząd):
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
                      placeholder="np. Wymiana klocków, oczekiwanie na części zamienne"
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
                      ✅ Oznacz jako NAPRAWIONE (Sprawny)
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="ODRZUCONE"
                      className="bg-red-600 hover:bg-red-500 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors"
                    >
                      Odrzuć zgłoszenie
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Raporty z tras z plikami */}
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
                    Kierowca: {report.duty.user.username} (Linia {report.duty.line.number}{report.duty.brigade ? ` • Brygada: ${report.duty.brigade}` : ""})
                  </span>
                  <span className="text-xs text-slate-400">
                    Data służby: {new Date(report.duty.date).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                  <div>Stan początkowy: <b className="text-emerald-400">{report.startMileage} km</b></div>
                  <div>Stan końcowy: <b className="text-emerald-400">{report.endMileage} km</b></div>
                  <div>Dystans: <b className="text-white">{report.endMileage - report.startMileage} km</b></div>
                  <div>
                    <a
                      href={report.startScreenshot}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-medium"
                    >
                      📷 Zobacz Screen Start &rarr;
                    </a>
                  </div>
                  <div>
                    <a
                      href={report.endScreenshot}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-medium"
                    >
                      📷 Zobacz Screen Koniec &rarr;
                    </a>
                  </div>
                  <div>
                    <a
                      href={report.summaryFile}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:underline font-medium"
                    >
                      📄 Otwórz Podsumowanie (.txt) &rarr;
                    </a>
                  </div>
                </div>
                <div className="flex gap-2">
                  <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=accept`} method="POST">
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors">
                      Akceptuj Raport
                    </button>
                  </form>
                  <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=reject`} method="POST">
                    <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors">
                      Odrzuć Raport
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Wiadomości kontaktowe z opcją odpowiedzi */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-purple-400 flex items-center justify-between">
          <span>📬 Skrzynka Wiadomości Kontaktowych ({contactMessages.length})</span>
        </h2>
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
                      <button type="submit" className="bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs">
                        Usuń
                      </button>
                    </form>
                  </div>
                </div>

                {/* Istniejąca odpowiedź */}
                {msg.reply && (
                  <div className="bg-slate-950/80 p-3 rounded border border-purple-800/40 text-xs space-y-1">
                    <span className="font-bold text-purple-300 block">Odpowiedź Zarządu ({msg.repliedAt ? new Date(msg.repliedAt).toLocaleString() : ""}):</span>
                    <p className="text-slate-200 whitespace-pre-wrap">{msg.reply}</p>
                  </div>
                )}

                {/* Formularz odpowiedzi */}
                <form action={`/api/panel/zarzad/wiadomosci?id=${msg.id}&action=reply`} method="POST" className="flex gap-2 items-center pt-1 border-t border-slate-800">
                  <input
                    type="text"
                    name="reply"
                    required
                    placeholder="Wpisz odpowiedź na tę wiadomość..."
                    className="flex-grow bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
                  />
                  <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap">
                    💬 Wyślij odpowiedź
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. Zarządzanie Liniami i Taborem */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Zarządzanie Liniami */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-emerald-400">Zarządzanie Liniami</h2>
          
          {/* Dodaj nową linię */}
          <form action="/api/panel/zarzad/linie" method="POST" className="space-y-3 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-white text-sm">➕ Dodaj Nową Linię</h3>
            <div>
              <input type="text" name="number" placeholder="Numer (np. 34)" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" name="directions" placeholder="Kierunki (np. A: Bukówka, B: Wichrowa)" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
              <input type="text" name="brigades" placeholder="Brygady (np. 1, 2, 3, 4)" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-xs outline-none text-white" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors">
              Zapisz nową linię
            </button>
          </form>

          {/* Lista linii z modyfikacją i usuwaniem */}
          <h3 className="text-sm font-semibold text-slate-400 mb-2">Zdefiniowane linie ({allLines.length}):</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {allLines.map((line) => (
              <div key={line.id} className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-sm space-y-2">
                <form action="/api/panel/zarzad/linie/edit" method="POST" className="space-y-2">
                  <input type="hidden" name="id" value={line.id} />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="number" defaultValue={line.number} required className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Numer linii" placeholder="Numer linii" />
                    <input type="text" name="directions" defaultValue={line.directions || ""} placeholder="Kierunki trasy" className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    <input type="text" name="brigades" defaultValue={line.brigades || ""} placeholder="Brygady (np. 1, 2)" className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
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

        {/* Zarządzanie Taborem z uploadem zdjęć */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-emerald-400">Zarządzanie Taborem</h2>
          
          {/* Dodaj pojazd ze zdjęciem */}
          <form action="/api/panel/zarzad/tabor" method="POST" encType="multipart/form-data" className="space-y-3 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-white text-sm">➕ Dodaj Nowy Pojazd</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <select name="carrier" required className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white">
                <option value="">Wybierz przewoźnika</option>
                <option value="VMPK">VMPK</option>
                <option value="VBP">VBP</option>
              </select>
              <input type="text" name="fleetNumber" placeholder="Nr taborowy (np. #103)" required className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
              <input type="text" name="model" placeholder="Model (np. Solaris Urbino 12)" required className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
              <input type="text" name="registration" placeholder="Rejestracja (np. TK 99999)" required className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
              <input type="number" name="mileage" placeholder="Przebieg [km] (np. 145000)" defaultValue="0" className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm outline-none text-white" />
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
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors">
              Zapisz pojazd do floty
            </button>
          </form>

          {/* Lista pojazdów z edycją, zdjęciem i usuwaniem */}
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
                    <select name="carrier" defaultValue={veh.carrier} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                      <option value="VMPK">VMPK</option>
                      <option value="VBP">VBP</option>
                    </select>
                    <input type="text" name="fleetNumber" defaultValue={veh.fleetNumber} required className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Nr taborowy" />
                    <select name="status" defaultValue={veh.status} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                      <option value="SPRAWNY">Sprawny</option>
                      <option value="WARSZTAT">Warsztat</option>
                      <option value="KASACJA">Kasacja</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" name="model" defaultValue={veh.model} required className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Model" />
                    <input type="text" name="registration" defaultValue={veh.registration} required className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Rejestracja" />
                    <input type="number" name="mileage" defaultValue={veh.mileage || 0} placeholder="Przebieg [km]" className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" title="Przebieg pojazdu [km]" />
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono">
                    Aktualny przebieg / postęp: <b>{(veh.mileage || 0).toLocaleString()} km</b>
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
                  <div className="flex justify-between items-center pt-1">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-semibold">
                      Zapisz zmiany
                    </button>
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
      </div>

      {/* 7. Zarządzanie Wykazem Brygad (Nowa funkcjonalność) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <h2 className="text-2xl font-bold text-amber-400">📋 Wykaz Brygad (Harmonogram, Odjazdy i Przesiadki)</h2>
          <a href="/brygady" target="_blank" className="text-xs text-amber-400 hover:underline">
            Zobacz publiczny widok brygad &rarr;
          </a>
        </div>

        {/* Formularz dodawania brygady */}
        <form action="/api/panel/zarzad/brygady" method="POST" className="space-y-4 bg-slate-900 p-5 rounded-lg border border-slate-700 mb-6">
          <h3 className="font-semibold text-white text-sm">➕ Dodaj Wpis do Wykazu Brygad</h3>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linia *</label>
              <select name="lineId" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                <option value="">Wybierz Linię</option>
                {allLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    Linia {line.number}{line.directions ? ` (${line.directions})` : (line.startStop ? ` (${line.startStop} - ${line.endStop})` : "")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Numer brygady *</label>
              <input type="text" name="brigadeNumber" placeholder="np. 34/1 lub Brygada 2" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Godzina startu / wyjazdu *</label>
              <input type="time" name="startTime" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Godzina zjazdu / końca *</label>
              <input type="time" name="endTime" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Miejsce wyjazdu / startu *</label>
              <input type="text" name="startLocation" placeholder="np. Zajezdnia VMPK / Bukówka" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Miejsce zjazdu / zakończenia *</label>
              <input type="text" name="endLocation" placeholder="np. Bukówka / Zajezdnia" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Przesiadki kierowców / podmiany na trasie</label>
              <input type="text" name="driverChanges" placeholder="np. Przesiadka na przystanku Żytnia o 09:30 z kierowcą B" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dodatkowe uwagi</label>
              <input type="text" name="notes" placeholder="np. Wymagana łączność radiowa, kurs skrócony" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded text-sm transition-colors">
            Zapisz brygadę do wykazu
          </button>
        </form>

        {/* Lista brygad z edycją i usuwaniem */}
        <h3 className="text-sm font-semibold text-slate-400 mb-3">Wpisy w wykazie ({brigadeSchedules.length}):</h3>
        {brigadeSchedules.length === 0 ? (
          <p className="text-slate-400 text-sm">Brak zdefiniowanych brygad w wykazie.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {brigadeSchedules.map((b) => (
              <div key={b.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg text-sm space-y-3">
                <form action="/api/panel/zarzad/brygady/edit" method="POST" className="space-y-3">
                  <input type="hidden" name="id" value={b.id} />
                  
                  <div className="grid md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Linia:</label>
                      <select name="lineId" defaultValue={b.lineId} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                        {allLines.map((l) => (
                          <option key={l.id} value={l.id}>Linia {l.number}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Brygada:</label>
                      <input type="text" name="brigadeNumber" defaultValue={b.brigadeNumber} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Start:</label>
                      <input type="time" name="startTime" defaultValue={b.startTime} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Koniec:</label>
                      <input type="time" name="endTime" defaultValue={b.endTime} required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-2">
                    <input type="text" name="startLocation" defaultValue={b.startLocation} placeholder="Start" required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    <input type="text" name="endLocation" defaultValue={b.endLocation} placeholder="Koniec" required className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-2">
                    <input type="text" name="driverChanges" defaultValue={b.driverChanges || ""} placeholder="Przesiadki kierowców" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                    <input type="text" name="notes" defaultValue={b.notes || ""} placeholder="Uwagi" className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white" />
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-xs font-semibold">
                      Zapisz zmiany
                    </button>
                    <button
                      type="submit"
                      formAction={`/api/panel/zarzad/brygady/delete?id=${b.id}`}
                      className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-semibold"
                    >
                      🗑 Usuń brygadę
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 8. Przydzielanie i usuwanie Służb (Grafik) */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-emerald-400">Wydawanie i Zarządzanie Służbami (Grafik)</h2>
        
        {/* Formularz wydawania */}
        <form action="/api/panel/zarzad/sluzby" method="POST" className="space-y-4 bg-slate-900 p-5 rounded-lg border border-slate-700 mb-6">
          <h3 className="font-semibold text-white text-sm">📅 Przydziel Nową Służbę</h3>
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Kierowca *</label>
              <select name="userId" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white">
                <option value="">Wybierz Kierowcę</option>
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.carrier})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Linia *</label>
              <select name="lineId" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white">
                <option value="">Wybierz Linię</option>
                {allLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    Linia {line.number}{line.directions ? ` (${line.directions})` : (line.startStop ? ` (${line.startStop} - ${line.endStop})` : "")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Pojazd z taboru</label>
              <select name="vehicleId" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white">
                <option value="">Wybierz Pojazd (opcjonalnie)</option>
                {allVehicles.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    {veh.fleetNumber} ({veh.model}) - {(veh.mileage || 0).toLocaleString()} km
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Brygada / Nazwa brygady</label>
              <input
                type="text"
                name="brigade"
                placeholder="np. 34/2 - dni robocze"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data służby *</label>
              <input type="date" name="date" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white" />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors">
            Przydziel służbę do grafiku
          </button>
        </form>

        {/* Lista przydzielonych służb z opcją usuwania */}
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
                    <span className="text-slate-400">&bull;</span>
                    <span className="font-semibold text-emerald-400">{duty.user.username} ({duty.user.carrier})</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${duty.status === 'SCHEDULED' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                      {duty.status === 'SCHEDULED' ? 'Zaplanowana' : 'Zrealizowana'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Trasa: {duty.line.directions || (duty.line.startStop ? `${duty.line.startStop} - ${duty.line.endStop}` : "Zgodnie z rozkładem")} &bull; Data: {new Date(duty.date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <form action={`/api/panel/zarzad/sluzby/delete?id=${duty.id}`} method="POST">
                    <button type="submit" className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold transition-colors">
                      🗑 Usuń służbę
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
