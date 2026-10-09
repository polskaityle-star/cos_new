"use client";

import { useState, useEffect } from "react";

interface UserItem {
  id: string;
  username: string;
  badgeNumber: string | null;
  carrier: string | null;
  assignedVehicle: { id: string; fleetNumber: string } | null;
}

interface LineItem {
  id: string;
  number: string;
  carrier: string | null;
  directions: string | null;
  startStop: string | null;
  endStop: string | null;
}

interface VehicleItem {
  id: string;
  fleetNumber: string;
  model: string;
  carrier: string;
  mileage: number;
}

interface BrigadeItem {
  id: string;
  lineId: string;
  brigadeNumber: string;
  carrier?: string | null;
  brigadeType?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  startTime2?: string | null;
  endTime2?: string | null;
  line?: { number: string; carrier?: string | null } | null;
}

interface PrefillData {
  driverId?: string;
  date?: string;
  vehicleId?: string;
  requestId?: string;
}

export default function DutyAssignmentForm({
  users,
  lines,
  vehicles,
  brigades,
  prefill,
}: {
  users: UserItem[];
  lines: LineItem[];
  vehicles: VehicleItem[];
  brigades: BrigadeItem[];
  prefill?: PrefillData;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>(prefill?.driverId || "");
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(prefill?.vehicleId || "");
  const [selectedDate, setSelectedDate] = useState<string>(prefill?.date || "");
  const [selectedBrigade, setSelectedBrigade] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("1 Zmiana");
  const [notes, setNotes] = useState<string>("");

  // Znajdź wybranego kierowcę
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const userCarrier = selectedUser?.carrier || null;

  // Filtrowanie linii ściśle pod przewoźnika kierowcy (Wymóg 4)
  const filteredLines = lines.filter((l) => {
    if (!userCarrier) return true;
    if (l.carrier) return l.carrier === userCarrier;
    return true; // jeśli linia ogólna
  });

  // Filtrowanie taboru ściśle pod przewoźnika kierowcy
  const filteredVehicles = vehicles.filter((v) => {
    if (!userCarrier) return true;
    return v.carrier === userCarrier;
  });

  // Filtrowanie brygad pod linię i przewoźnika kierowcy (Wymóg 4)
  const filteredBrigades = brigades.filter((b) => {
    if (selectedLineId && b.lineId !== selectedLineId) return false;
    if (!userCarrier) return true;
    if (b.carrier) return b.carrier === userCarrier;
    if (b.line?.carrier) return b.line.carrier === userCarrier;
    return true;
  });

  // Reakcja na zmianę kierowcy: jeśli ma stały pojazd i nie ma prefillu wozu, ustaw go
  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    const u = users.find((x) => x.id === userId);
    if (u?.assignedVehicle?.id) {
      setSelectedVehicleId(u.assignedVehicle.id);
    } else {
      setSelectedVehicleId("");
    }
    // Zresetuj linię jeśli wybrana nie pasuje do przewoźnika
    if (selectedLineId && u?.carrier) {
      const currentLine = lines.find((l) => l.id === selectedLineId);
      if (currentLine && currentLine.carrier && currentLine.carrier !== u.carrier) {
        setSelectedLineId("");
        setSelectedBrigade("");
      }
    }
  };

  useEffect(() => {
    if (prefill?.driverId) {
      setSelectedUserId(prefill.driverId);
    }
    if (prefill?.date) {
      setSelectedDate(prefill.date);
    }
    if (prefill?.vehicleId) {
      setSelectedVehicleId(prefill.vehicleId);
    }
  }, [prefill]);

  return (
    <form
      id="grafik-form"
      action="/api/panel/zarzad/sluzby"
      method="POST"
      className="space-y-4 bg-slate-900 p-5 rounded-lg border border-slate-700 mb-6 shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <span>{prefill?.requestId ? "✅ Zatwierdź Służbę z Wniosku" : "📅 Przydziel Nową Służbę do Grafiku"}</span>
        </h3>
        {userCarrier && (
          <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Przewoźnik kierowcy: {userCarrier}
          </span>
        )}
      </div>

      {prefill?.requestId && (
        <div className="bg-emerald-950/60 border border-emerald-600/50 p-3 rounded-lg text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-xs">
          <div>
            <span className="font-bold block text-sm text-white">
              ✨ Realizacja wniosku o dodatkową służbę
            </span>
            Kierowca, data oraz autobus zostały uzupełnione zgodnie z wnioskiem. Wybierz tylko linię i brygadę.
          </div>
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shrink-0">
            Wniosek aktywny
          </span>
          <input type="hidden" name="requestId" value={prefill.requestId} />
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-3">
        {/* 1. Wybór kierowcy */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Kierowca *
          </label>
          <select
            name="userId"
            value={selectedUserId}
            onChange={(e) => handleUserChange(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
          >
            <option value="">Wybierz Kierowcę</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.badgeNumber ? `[${user.badgeNumber}] ` : ""}
                {user.username} [{user.carrier || "Brak"}]
                {user.assignedVehicle ? ` (Stały: #${user.assignedVehicle.fleetNumber})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Wybór linii (filtrowany pod przewoźnika kierowcy) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Linia * {userCarrier && <span className="text-amber-400 font-normal">({userCarrier})</span>}
          </label>
          <select
            name="lineId"
            value={selectedLineId}
            onChange={(e) => {
              const newLineId = e.target.value;
              setSelectedLineId(newLineId);
              setSelectedBrigade("");
              const line = lines.find((l) => l.id === newLineId);
              if (line) {
                const num = line.number.toUpperCase();
                if (num.startsWith("N") || num === "N1" || num === "N2") {
                  setSelectedShift("3 Zmiana");
                } else {
                  setSelectedShift("1 Zmiana");
                }
              } else {
                setSelectedShift("1 Zmiana");
              }
            }}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
          >
            <option value="">Wybierz Linię</option>
            {filteredLines.map((line) => (
              <option key={line.id} value={line.id}>
                Linia {line.number}
                {line.carrier ? ` [${line.carrier}]` : ""}
                {line.directions
                  ? ` (${line.directions})`
                  : line.startStop
                  ? ` (${line.startStop} - ${line.endStop})`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Pojazd z taboru - OBOWIĄZKOWY wg Wymogu 7 */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Pojazd z taboru * {userCarrier && <span className="text-amber-400 font-normal">({userCarrier})</span>}
          </label>
          <select
            name="vehicleId"
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
          >
            <option value="">-- Wybierz Pojazd * --</option>
            {filteredVehicles.map((veh) => (
              <option key={veh.id} value={veh.id}>
                #{veh.fleetNumber} ({veh.model}) [{veh.carrier}] - {veh.mileage.toLocaleString()} km
              </option>
            ))}
          </select>
        </div>

        {/* 4. Zmiana (Wyjazd / Podmiana-Przesiadka dla linii dziennych, 3 Zmiana dla linii nocnych) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Zmiana służby *
          </label>
          {(() => {
            const curLine = lines.find((l) => l.id === selectedLineId);
            const isNight = Boolean(
              curLine &&
                (curLine.number.toUpperCase().startsWith("N") ||
                  curLine.number.toUpperCase().includes("N1") ||
                  curLine.number.toUpperCase().includes("N2"))
            );

            return (
              <select
                name="shift"
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
              >
                {isNight ? (
                  <option value="3 Zmiana">3 Zmiana (Nocna)</option>
                ) : (
                  <>
                    <option value="1 Zmiana">1 Zmiana (Wyjazd)</option>
                    <option value="2 Zmiana">2 Zmiana (Podmiana / Przesiadka)</option>
                  </>
                )}
              </select>
            );
          })()}
        </div>

        {/* 5. Brygada - filtrowana pod linię i przewoźnika (bez godzin) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Brygada
          </label>
          <input
            type="text"
            name="brigade"
            value={selectedBrigade}
            onChange={(e) => setSelectedBrigade(e.target.value)}
            list="duty-brigades-datalist"
            placeholder="np. 2/1 - Dni robocze"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
          />
          <datalist id="duty-brigades-datalist">
            {filteredBrigades.map((b) => {
              const isPeak = b.brigadeType === "SZCZYTOWA" || Boolean(b.startTime2 || b.endTime2);
              return (
                <option key={b.id} value={b.brigadeNumber}>
                  {b.line?.number ? `Linia ${b.line.number} - ` : ""}{b.brigadeNumber}
                  {isPeak ? " [SZCZYTOWA]" : ""}
                </option>
              );
            })}
          </datalist>
          {selectedBrigade && (
            <span className="text-[10px] text-amber-300 mt-1 block truncate font-mono">
              Zapis: {selectedBrigade.includes("Zmiana") ? selectedBrigade : `${selectedBrigade}/${selectedShift}`}
            </span>
          )}
        </div>

        {/* 6. Data służby */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Data służby *
          </label>
          <input
            type="date"
            name="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm outline-none text-white focus:border-amber-500"
          />
        </div>
      </div>

      {/* 6. Opcjonalne uwagi wg Wymogu 8 */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">
          Uwagi do służby (opcjonalnie)
        </label>
        <input
          type="text"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="np. Dodatkowa służba z wniosku, obsługa wariantu nocnego"
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs outline-none text-white focus:border-amber-500"
        />
      </div>

      {/* 7. Oznaczenie służby dodatkowej (Wymóg 11: odrabianie niezaliczonych służb) */}
      <div className="flex items-center justify-between gap-3 bg-slate-800/60 p-2.5 rounded border border-slate-700">
        <label className="inline-flex items-center gap-2 text-xs text-amber-300 font-semibold cursor-pointer">
          <input
            type="checkbox"
            name="isExtra"
            value="true"
            defaultChecked={Boolean(prefill?.requestId)}
            className="rounded border-slate-600 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
          />
          <span>⭐ Służba dodatkowa (odrabia niezaliczone służby w profilu kierowcy)</span>
        </label>
        {prefill?.requestId && (
          <span className="text-[10px] bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
            Z wniosku o dodatkową służbę
          </span>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded text-sm transition-colors shadow-md cursor-pointer"
      >
        {prefill?.requestId ? "✓ Zatwierdź" : "Przydziel służbę do grafiku"}
      </button>
    </form>
  );
}
