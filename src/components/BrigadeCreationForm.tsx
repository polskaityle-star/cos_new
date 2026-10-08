"use client";

import { useState } from "react";

interface LineOption {
  id: string;
  number: string;
  carrier: string | null;
  directions: string | null;
  startStop: string | null;
  endStop: string | null;
}

export default function BrigadeCreationForm({ lines }: { lines: LineOption[] }) {
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [carrier, setCarrier] = useState<string>("");

  const handleLineChange = (lineId: string) => {
    setSelectedLineId(lineId);
    const line = lines.find((l) => l.id === lineId);
    // Wymóg 10: po wybraniu linii z VMPK zaznacz VMPK, a z VBP zaznacz VBP
    if (line?.carrier) {
      setCarrier(line.carrier);
    } else {
      setCarrier("");
    }
  };

  return (
    <form
      action="/api/panel/zarzad/brygady"
      method="POST"
      className="space-y-4 bg-slate-900 p-5 rounded-lg border border-slate-700 mb-6 shadow-md"
    >
      <h3 className="font-semibold text-white text-sm">➕ Dodaj Wpis do Wykazu Brygad</h3>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Linia *</label>
          <select
            name="lineId"
            value={selectedLineId}
            onChange={(e) => handleLineChange(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          >
            <option value="">Wybierz Linię</option>
            {lines.map((line) => (
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

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Przewoźnik brygady</label>
          <select
            name="carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          >
            <option value="">Zgodnie z linią</option>
            <option value="VMPK">VMPK</option>
            <option value="VBP">VBP</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Numer brygady *</label>
          <input
            type="text"
            name="brigadeNumber"
            placeholder="np. 34/1 - dni robocze, 34/1 - sobotni"
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>

        {/* Wymóg 5: Godzina Wyjazdu i Zjazdu jako opcjonalne */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Wyjazd (opcjonalnie)</label>
            <input
              type="time"
              name="startTime"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Zjazd (opcjonalnie)</label>
            <input
              type="time"
              name="endTime"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Godzina pierwszego przystanku (opcjonalnie)
          </label>
          <input
            type="time"
            name="firstStopDeparture"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Godzina ostatniego przystanku (opcjonalnie)
          </label>
          <input
            type="time"
            name="lastStopArrival"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Miejsce wyjazdu / startu (opcjonalnie)</label>
          <input
            type="text"
            name="startLocation"
            placeholder="np. Zajezdnia VMPK / Bukówka"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Miejsce zjazdu / zakończenia (opcjonalnie)</label>
          <input
            type="text"
            name="endLocation"
            placeholder="np. Bukówka / Zajezdnia"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Przesiadki kierowców / podmiany na trasie
          </label>
          <input
            type="text"
            name="driverChanges"
            placeholder="np. Przesiadka na przystanku Żytnia o 09:30 z kierowcą B"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Dodatkowe uwagi</label>
          <input
            type="text"
            name="notes"
            placeholder="np. Wymagana łączność radiowa, kurs skrócony"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded text-sm transition-colors shadow-md"
      >
        Zapisz brygadę do wykazu
      </button>
    </form>
  );
}
