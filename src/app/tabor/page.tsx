import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ carrier?: string }> }) {
  const { carrier: carrierFilter } = await searchParams;
  
  const vehicles = await prisma.vehicle.findMany({
    where: carrierFilter ? { carrier: carrierFilter } : undefined,
    orderBy: { fleetNumber: 'asc' }
  });

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold mb-6">Nasz Tabor</h1>
      
      <div className="flex gap-4 mb-8">
        <a href="/tabor" className={`px-4 py-2 rounded-lg border ${!carrierFilter ? 'bg-slate-700 border-slate-600' : 'border-slate-700 hover:bg-slate-800'}`}>Wszystkie</a>
        <a href="/tabor?carrier=VMPK" className={`px-4 py-2 rounded-lg border ${carrierFilter === 'VMPK' ? 'bg-[#E31837] border-red-500' : 'border-slate-700 hover:bg-slate-800'}`}>Tylko VMPK</a>
        <a href="/tabor?carrier=VBP" className={`px-4 py-2 rounded-lg border ${carrierFilter === 'VBP' ? 'bg-[#005A9C] border-blue-500' : 'border-slate-700 hover:bg-slate-800'}`}>Tylko VBP</a>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-slate-800 p-6 rounded-lg text-center text-slate-400">
          Brak pojazdów spełniających kryteria.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicles.map((veh) => (
            <div key={veh.id} className={`bg-slate-800 border-l-4 rounded-r-xl overflow-hidden shadow-md ${veh.carrier === 'VMPK' ? 'border-[#E31837]' : 'border-[#005A9C]'}`}>
              <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${veh.carrier === 'VMPK' ? 'bg-red-900/50 text-red-200' : 'bg-blue-900/50 text-blue-200'}`}>
                  {veh.carrier}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  veh.status === 'SPRAWNY' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40' :
                  veh.status === 'WARSZTAT' ? 'bg-amber-900/60 text-amber-300 border border-amber-600/40' :
                  'bg-rose-900/60 text-rose-300 border border-rose-600/40'
                }`}>
                  {veh.status === 'SPRAWNY' ? '● Sprawny' : veh.status === 'WARSZTAT' ? '🛠 Warsztat' : '✕ Wyłączony'}
                </span>
              </div>
              {veh.imageUrl && (
                <div className="h-44 w-full overflow-hidden bg-slate-900 border-b border-slate-700">
                  <img
                    src={veh.imageUrl}
                    alt={`${veh.model} ${veh.fleetNumber}`}
                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                  />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Numer taborowy</div>
                  <div className="text-xl font-bold font-mono">{veh.fleetNumber}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Model</div>
                  <div className="font-semibold">{veh.model}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Rejestracja</div>
                  <div className="font-mono text-sm bg-white text-black px-2 py-0.5 rounded inline-block border border-gray-400">{veh.registration}</div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-700/60">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">Przebieg / Postęp</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {(veh.mileage || 0).toLocaleString()} km
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
