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
  const [brigadeType, setBrigadeType] = useState<"NORMALNA" | "SZCZYTOWA">("NORMALNA");

  const handleLineChange = (lineId: string) => {
    setSelectedLineId(lineId);
    const line = lines.find((l) => l.id === lineId);
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
      className="space-y-5 bg-slate-900 p-5 rounded-lg border border-slate-700 mb-6 shadow-md"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h3 className="font-semibold text-white text-base flex items-center gap-2">
          <span>➕ Dodaj Wpis do Wykazu Brygad</span>
        </h3>

        {/* Wybór typu brygady: Normalna vs Szczytowa */}
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <input type="hidden" name="brigadeType" value={brigadeType} />
          <button
            type="button"
            onClick={() => setBrigadeType("NORMALNA")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              brigadeType === "NORMALNA"
                ? "bg-sky-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🚌 Normalna (całodzienna)</span>
          </button>
          <button
            type="button"
            onClick={() => setBrigadeType("SZCZYTOWA")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              brigadeType === "SZCZYTOWA"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>⚡ Szczytowa (2 wyjazdy/zjazdy)</span>
          </button>
        </div>
      </div>

      {/* Podstawowe dane brygady */}
      <div className="grid md:grid-cols-3 gap-3">
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
            placeholder={
              brigadeType === "SZCZYTOWA"
                ? "np. 34/S1 - dni robocze, 10/bis"
                : "np. 34/1 - dni robocze, 34/1 - sobotni"
            }
            required
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* SEKCJA I: Wyjazd I i Zjazd I (dla Normalnej jest to jedyny wyjazd/zjazd, dla Szczytowej Szczyt Poranny) */}
      <div className={`p-4 rounded-lg border ${
        brigadeType === "SZCZYTOWA"
          ? "bg-purple-950/20 border-purple-800/50"
          : "bg-slate-800/50 border-slate-700/50"
      }`}>
        {brigadeType === "SZCZYTOWA" && (
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-800/30">
            <span className="text-base">🌅</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
              I Wyjazd i Zjazd (Szczyt poranny)
            </h4>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Godzina Wyjazdu I (opcjonalnie)" : "Godzina Wyjazdu (opcjonalnie)"}
            </label>
            <input
              type="time"
              name="startTime"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Godzina Zjazdu I (opcjonalnie)" : "Godzina Zjazdu (opcjonalnie)"}
            </label>
            <input
              type="time"
              name="endTime"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Godzina 1. przystanku I (opcjonalnie)" : "Godzina pierwszego przystanku (opcjonalnie)"}
            </label>
            <input
              type="time"
              name="firstStopDeparture"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Godzina ostatniego przystanku I (opcjonalnie)" : "Godzina ostatniego przystanku (opcjonalnie)"}
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Miejsce wyjazdu I (opcjonalnie)" : "Miejsce wyjazdu / startu (opcjonalnie)"}
            </label>
            <input
              type="text"
              name="startLocation"
              placeholder="np. Zajezdnia VMPK / Bukówka"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {brigadeType === "SZCZYTOWA" ? "Miejsce zjazdu I (opcjonalnie)" : "Miejsce zjazdu / zakończenia (opcjonalnie)"}
            </label>
            <input
              type="text"
              name="endLocation"
              placeholder="np. Bukówka / Zajezdnia"
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* SEKCJA II: II Wyjazd i II Zjazd (tylko dla brygady SZCZYTOWEJ) */}
      {brigadeType === "SZCZYTOWA" && (
        <div className="p-4 rounded-lg border bg-purple-950/20 border-purple-800/50">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-800/30">
            <span className="text-base">🌇</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
              II Wyjazd i Zjazd (Szczyt popołudniowy)
            </h4>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Godzina Wyjazdu II (opcjonalnie)
              </label>
              <input
                type="time"
                name="startTime2"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Godzina Zjazdu II (opcjonalnie)
              </label>
              <input
                type="time"
                name="endTime2"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Godzina 1. przystanku II (opcjonalnie)
              </label>
              <input
                type="time"
                name="firstStopDeparture2"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Godzina ostatniego przystanku II (opcjonalnie)
              </label>
              <input
                type="time"
                name="lastStopArrival2"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Miejsce wyjazdu II (opcjonalnie)
              </label>
              <input
                type="text"
                name="startLocation2"
                placeholder="np. Zajezdnia VMPK / Bukówka"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Miejsce zjazdu II (opcjonalnie)
              </label>
              <input
                type="text"
                name="endLocation2"
                placeholder="np. Bukówka / Zajezdnia"
                className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Przesiadki i Uwagi */}
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
        className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded text-sm transition-colors shadow-md flex items-center justify-center gap-2"
      >
        <span>Zapisz brygadę ({brigadeType === "SZCZYTOWA" ? "Szczytowa" : "Normalna"}) do wykazu</span>
      </button>
    </form>
  );
}
