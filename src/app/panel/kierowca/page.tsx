import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DriverPanel() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  // Wymuszaj logowanie dla kierowcow i zarzadu
  if (session.user.role !== "KIEROWCA" && session.user.role !== "ZARZAD") {
    redirect("/");
  }

  const duties = await prisma.duty.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      line: true,
      report: true,
    },
    orderBy: {
      date: 'desc'
    }
  });

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Panel Kierowcy - {session.user.username}</h1>
      
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-semibold mb-4">Twoje Służby (Grafik)</h2>
        {duties.length === 0 ? (
          <p className="text-slate-400">Nie masz przypisanych żadnych służb.</p>
        ) : (
          <div className="space-y-4">
            {duties.map(duty => (
              <div key={duty.id} className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xl font-bold">Linia {duty.line.number}</div>
                  <div className="text-sm text-slate-400">Data: {new Date(duty.date).toLocaleDateString()}</div>
                  <div className="text-sm text-slate-400">Trasa: {duty.line.startStop} - {duty.line.endStop}</div>
                </div>
                <div>
                  {duty.status === "SCHEDULED" ? (
                    <a href={`/panel/kierowca/raport?dutyId=${duty.id}`} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded font-semibold transition-colors">
                      Złóż raport
                    </a>
                  ) : (
                    <div className="text-center">
                      <span className="bg-slate-700 px-3 py-1 rounded text-sm block mb-1">Status raportu: {duty.report?.status || 'Brak'}</span>
                      <span className="text-emerald-400 font-bold block text-sm">Zrealizowano</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
