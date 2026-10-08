"use client";

import { useState } from "react";
import { getDayBadgeClass, getDayLabel, isPeakBrigade } from "@/lib/brigades";

interface LineOption {
  id: string;
  number: string;
  carrier?: string | null;
}

interface BrigadeData {
  id?: string;
  lineId?: string;
  carrier?: string | null;
  brigadeType?: string | null;
  brigadeNumber: string;
  startTime?: string | null;
  endTime?: string | null;
  firstStopDeparture?: string | null;
  lastStopArrival?: string | null;
  startLocation?: string | null;
  endLocation?: string | null;

  startTime2?: string | null;
  endTime2?: string | null;
  firstStopDeparture2?: string | null;
  lastStopArrival2?: string | null;
  startLocation2?: string | null;
  endLocation2?: string | null;

  driverChanges?: string | null;
  notes?: string | null;
}

export default function BrigadeEditCard({
  brigade,
  lines,
}: {
  brigade: BrigadeData;
  lines: LineOption[];
}) {
  const initialPeak = isPeakBrigade(brigade);
  const [brigadeType, setBrigadeType] = useState<"NORMALNA" | "SZCZYTOWA">(
    initialPeak ? "SZCZYTOWA" : "NORMALNA"
  );

  return (
    <div className={`border p-4 rounded-lg text-sm space-y-3 transition-colors ${
      brigadeType === "SZCZYTOWA"
        ? "bg-purple-950/20 border-purple-800/60"
        : "bg-slate-900 border-slate-700"
    }`}>
      <form action="/api/panel/zarzad/brygady/edit" method="POST" className="space-y-3">
        <input type="hidden" name="id" value={brigade.id} />
        <input type="hidden" name="brigadeType" value={brigadeType} />

        {/* Pasek nagłówka karty */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded border ${getDayBadgeClass(brigade.brigadeNumber, brigade.notes)}`}>
              {getDayLabel(brigade.brigadeNumber, brigade.notes)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              brigadeType === "SZCZYTOWA"
                ? "bg-purple-900/60 border-purple-600/50 text-purple-200"
                : "bg-sky-900/60 border-sky-600/50 text-sky-200"
            }`}>
              {brigadeType === "SZCZYTOWA" ? "⚡ SZCZYTOWA (2 wyjazdy/zjazdy)" : "🚌 NORMALNA"}
            </span>
          </div>

          {/* Przełącznik typu */}
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => setBrigadeType("NORMALNA")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                brigadeType === "NORMALNA" ? "bg-sky-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Normalna
            </button>
            <button
              type="button"
              onClick={() => setBrigadeType("SZCZYTOWA")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                brigadeType === "SZCZYTOWA" ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Szczytowa
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Linia:</label>
            <select
              name="lineId"
              defaultValue={brigade.lineId}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  Linia {l.number}{l.carrier ? ` [${l.carrier}]` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Przewoźnik:</label>
            <select
              name="carrier"
              defaultValue={brigade.carrier || ""}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            >
              <option value="">Domyślny</option>
              <option value="VMPK">VMPK</option>
              <option value="VBP">VBP</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">Numer brygady:</label>
            <input
              type="text"
              name="brigadeNumber"
              defaultValue={brigade.brigadeNumber}
              required
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "Wyjazd I (opcjonalnie):" : "Godzina Wyjazdu (opcjonalnie):"}
            </label>
            <input
              type="time"
              name="startTime"
              defaultValue={brigade.startTime || ""}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "Zjazd I (opcjonalnie):" : "Godzina Zjazdu (opcjonalnie):"}
            </label>
            <input
              type="time"
              name="endTime"
              defaultValue={brigade.endTime || ""}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        {/* Szczegóły przystanków i tras: Zmiana I */}
        <div className="grid md:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "1. przystanek I:" : "Godzina 1. przystanku:"}
            </label>
            <input
              type="time"
              name="firstStopDeparture"
              defaultValue={brigade.firstStopDeparture || ""}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "Ost. przystanek I:" : "Godzina ost. przystanku:"}
            </label>
            <input
              type="time"
              name="lastStopArrival"
              defaultValue={brigade.lastStopArrival || ""}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "Start I:" : "Miejsce wyjazdu / startu:"}
            </label>
            <input
              type="text"
              name="startLocation"
              defaultValue={brigade.startLocation || ""}
              placeholder="Start"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">
              {brigadeType === "SZCZYTOWA" ? "Koniec I:" : "Miejsce zjazdu / końca:"}
            </label>
            <input
              type="text"
              name="endLocation"
              defaultValue={brigade.endLocation || ""}
              placeholder="Koniec"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        {/* Zmiana II (tylko dla brygady szczytowej) */}
        {brigadeType === "SZCZYTOWA" && (
          <div className="bg-purple-900/20 border border-purple-800/40 p-2.5 rounded space-y-2">
            <span className="text-[11px] font-bold text-purple-300 block">
              🌇 II Wyjazd i Zjazd (Szczyt popołudniowy)
            </span>
            <div className="grid md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Wyjazd II:</label>
                <input
                  type="time"
                  name="startTime2"
                  defaultValue={brigade.startTime2 || ""}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Zjazd II:</label>
                <input
                  type="time"
                  name="endTime2"
                  defaultValue={brigade.endTime2 || ""}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">1. przystanek II:</label>
                <input
                  type="time"
                  name="firstStopDeparture2"
                  defaultValue={brigade.firstStopDeparture2 || ""}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Ost. przystanek II:</label>
                <input
                  type="time"
                  name="lastStopArrival2"
                  defaultValue={brigade.lastStopArrival2 || ""}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Start II:</label>
                <input
                  type="text"
                  name="startLocation2"
                  defaultValue={brigade.startLocation2 || ""}
                  placeholder="Start szczytu popołudniowego"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-0.5">Koniec II:</label>
                <input
                  type="text"
                  name="endLocation2"
                  defaultValue={brigade.endLocation2 || ""}
                  placeholder="Koniec szczytu popołudniowego"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Przesiadki kierowców / podmiany:</label>
            <input
              type="text"
              name="driverChanges"
              defaultValue={brigade.driverChanges || ""}
              placeholder="Przesiadki kierowców"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-0.5">Dodatkowe uwagi:</label>
            <input
              type="text"
              name="notes"
              defaultValue={brigade.notes || ""}
              placeholder="Uwagi"
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow"
          >
            💾 Zapisz zmiany ({brigadeType === "SZCZYTOWA" ? "Szczytowa" : "Normalna"})
          </button>
          <button
            type="submit"
            formAction={`/api/panel/zarzad/brygady/delete?id=${brigade.id}`}
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-semibold"
          >
            🗑 Usuń brygadę
          </button>
        </div>
      </form>
    </div>
  );
}
