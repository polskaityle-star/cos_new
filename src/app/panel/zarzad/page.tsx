import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ZARZAD") {
    redirect("/");
  }

  const pendingUsers = await prisma.user.findMany({
    where: { status: "PENDING" },
  });

  const allLines = await prisma.line.findMany();
  const allVehicles = await prisma.vehicle.findMany();
  const activeUsers = await prisma.user.findMany({
    where: { status: "ACCEPTED" },
  });

  const pendingReports = await prisma.report.findMany({
    where: { status: "PENDING" },
    include: {
      duty: {
        include: {
          user: true,
          line: true
        }
      }
    }
  });

  return (
    <div className="space-y-12">
      <h1 className="text-4xl font-bold text-emerald-400">Panel Zarządu (Zarządzanie)</h1>

      {/* Akceptacja uzytkownikow */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-yellow-400">Oczekujące wnioski (Rekrutacja)</h2>
        {pendingUsers.length === 0 ? (
          <p className="text-slate-400">Brak nowych wniosków rekrutacyjnych.</p>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map(user => (
              <div key={user.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="font-bold">Nick: {user.username}</div>
                  <div className="text-sm text-slate-400">Złożono: {new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <form action={`/api/panel/zarzad/akceptacja?userId=${user.id}&action=accept`} method="POST">
                    <select name="carrier" required className="bg-slate-800 border border-slate-600 rounded px-2 py-1 mr-2 outline-none">
                      <option value="">Wybierz przewoźnika</option>
                      <option value="VMPK">VMPK</option>
                      <option value="VBP">VBP</option>
                    </select>
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded">Akceptuj</button>
                  </form>
                  <form action={`/api/panel/zarzad/akceptacja?userId=${user.id}&action=reject`} method="POST">
                    <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded">Odrzuć</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Akceptacja Raportow */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-bold mb-4 text-blue-400">Oczekujące Raporty z Tras</h2>
        {pendingReports.length === 0 ? (
          <p className="text-slate-400">Brak raportów do sprawdzenia.</p>
        ) : (
          <div className="space-y-4">
            {pendingReports.map(report => (
              <div key={report.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                  <span className="font-bold">Kierowca: {report.duty.user.username} (Linia {report.duty.line.number})</span>
                  <span className="text-sm text-slate-400">Data służby: {new Date(report.duty.date).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>Stan początkowy: {report.startMileage} km</div>
                  <div>Stan końcowy: {report.endMileage} km</div>
                  <div><a href={report.startScreenshot} target="_blank" className="text-emerald-400 hover:underline">Screen Start &rarr;</a></div>
                  <div><a href={report.endScreenshot} target="_blank" className="text-emerald-400 hover:underline">Screen Koniec &rarr;</a></div>
                  <div className="col-span-2"><a href={report.summaryFile} target="_blank" className="text-blue-400 hover:underline">Podsumowanie .txt &rarr;</a></div>
                </div>
                <div className="flex gap-2">
                   <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=accept`} method="POST">
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded">Akceptuj Raport</button>
                  </form>
                  <form action={`/api/panel/zarzad/raporty?reportId=${report.id}&action=reject`} method="POST">
                    <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded">Odrzuć Raport</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Linie */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-4">Zarządzanie Liniami</h2>
          <form action="/api/panel/zarzad/linie" method="POST" className="space-y-4 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-emerald-400">Dodaj Linię</h3>
            <input type="text" name="number" placeholder="Numer linii (np. 34)" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <input type="text" name="startStop" placeholder="Przystanek początkowy" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <input type="text" name="endStop" placeholder="Przystanek końcowy" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded">Dodaj linię</button>
          </form>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {allLines.map(line => (
              <div key={line.id} className="bg-slate-900 p-2 rounded text-sm flex justify-between">
                <span>{line.number} ({line.startStop} - {line.endStop})</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tabor */}
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-4">Zarządzanie Taborem</h2>
          <form action="/api/panel/zarzad/tabor" method="POST" className="space-y-4 mb-6 bg-slate-900 p-4 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-emerald-400">Dodaj Pojazd</h3>
            <select name="carrier" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none">
              <option value="">Wybierz przewoźnika</option>
              <option value="VMPK">VMPK</option>
              <option value="VBP">VBP</option>
            </select>
            <input type="text" name="model" placeholder="Model (np. Solaris Urbino 12)" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <input type="text" name="registration" placeholder="Rejestracja (np. TK 12345)" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <input type="text" name="fleetNumber" placeholder="Numer taborowy (np. #101)" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded">Dodaj pojazd</button>
          </form>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {allVehicles.map(veh => (
              <div key={veh.id} className="bg-slate-900 p-2 rounded text-sm flex justify-between">
                <span>{veh.fleetNumber} - {veh.model} ({veh.carrier})</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      
      {/* Nadawanie sluzb */}
      <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h2 className="text-2xl font-bold mb-4">Wydawanie Służb (Grafik)</h2>
          <form action="/api/panel/zarzad/sluzby" method="POST" className="space-y-4 bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="grid md:grid-cols-3 gap-4">
              <select name="userId" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none">
                <option value="">Wybierz Kierowcę</option>
                {activeUsers.map(user => <option key={user.id} value={user.id}>{user.username} ({user.carrier})</option>)}
              </select>
              <select name="lineId" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none">
                <option value="">Wybierz Linię</option>
                {allLines.map(line => <option key={line.id} value={line.id}>{line.number}</option>)}
              </select>
              <input type="date" name="date" required className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 outline-none" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-2 rounded">Przydziel służbę</button>
          </form>
      </section>

    </div>
  );
}
