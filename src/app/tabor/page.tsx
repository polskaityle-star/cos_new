import { prisma } from "@/lib/prisma";

export default async function FleetPage({ searchParams }: { searchParams: { carrier?: string } }) {
  const carrierFilter = searchParams.carrier;
  
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
              <div className="p-4 border-b border-slate-700 bg-slate-800/50">
                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${veh.carrier === 'VMPK' ? 'bg-red-900/50 text-red-200' : 'bg-blue-900/50 text-blue-200'}`}>
                  {veh.carrier}
                </span>
              </div>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
