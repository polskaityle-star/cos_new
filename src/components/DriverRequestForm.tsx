"use client";

import { useState } from "react";

interface ScheduledDuty {
  id: string;
  date: Date | string;
  line: { number: string };
  brigade?: string | null;
}

interface VehicleItem {
  id: string;
  fleetNumber: string;
  model: string;
  registration: string;
  carrier: string;
}

const ETAT_DAYS = [
  { id: "PN", label: "Poniedziałek" },
  { id: "WT", label: "Wtorek" },
  { id: "SR", label: "Środa" },
  { id: "CZ", label: "Czwartek" },
  { id: "PT", label: "Piątek" },
  { id: "SO", label: "Sobota" },
  { id: "ND", label: "Niedziela" },
];

export default function DriverRequestForm({
  scheduledDuties,
  availableVehicles,
}: {
  scheduledDuties: ScheduledDuty[];
  availableVehicles: VehicleItem[];
}) {
  const [type, setType] = useState<"URLOP" | "DODATKOWA_SLUZBA" | "ANULOWANIE_SLUZBY" | "STALY_POJAZD" | "ZMIANA_ETATU">("URLOP");
  const [selectedDays, setSelectedDays] = useState<string[]>(["PN", "WT", "SR", "CZ", "PT"]);
  const [etatError, setEtatError] = useState("");

  const toggleDay = (dayId: string) => {
    setEtatError("");
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      const next = [...selectedDays, dayId];
      if (next.length >= 7) {
        setEtatError("⚠️ Brak możliwości przekroczenia etatu 6/7! Maksymalnie 6 dni w tygodniu.");
      }
      setSelectedDays(next);
    }
  };

  return (
    <form action="/api/panel/kierowca/wniosek" method="POST" className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Typ wniosku *</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          required
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100"
        >
          <option value="URLOP">🏖 Wniosek o urlop</option>
          <option value="DODATKOWA_SLUZBA">➕ Wniosek o dodatkową służbę</option>
          <option value="ANULOWANIE_SLUZBY">❌ Prośba o anulowanie służby</option>
          <option value="STALY_POJAZD">🚌 Wniosek o stały pojazd / zmiana stałego pojazdu</option>
          <option value="ZMIANA_ETATU">📅 Wniosek o zmianę etatu (dni pracy)</option>
        </select>
      </div>

      {/* URLOP: tylko daty, data poczatkowa (dla urlopu) */}
      {type === "URLOP" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data początkowa (dla urlopu) *
              </label>
              <input
                type="date"
                name="dateStart"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data końcowa (dla urlopu) *
              </label>
              <input
                type="date"
                name="dateEnd"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Powód / uwagi (opcjonalnie)
            </label>
            <textarea
              name="reason"
              rows={2}
              placeholder="Opcjonalny powód lub uwagi do urlopu..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* DODATKOWA SLUZBA: wybrany w danym dniu, usuniete uzasadnienie */}
      {type === "DODATKOWA_SLUZBA" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wybierz dzień w którym chcesz dodatkową służbę *
            </label>
            <input
              type="date"
              name="dateStart"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Preferowana linia / zmiana (opcjonalnie)
            </label>
            <input
              type="text"
              name="details"
              placeholder="np. Preferowana linia 34, zmiana ranna lub popołudniowa"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
            />
          </div>
          {/* Uzasadnienie usunięte zgodnie z punktem 14 */}
          <input type="hidden" name="reason" value="Wniosek o dodatkową służbę" />
        </div>
      )}

      {/* ANULOWANIE SLUZBY: wybierz dzien w ktorym jest sluzba */}
      {type === "ANULOWANIE_SLUZBY" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wybierz dzień w którym jest służba / służbę do anulowania *
            </label>
            {scheduledDuties.length > 0 ? (
              <select
                name="dutyId"
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
              >
                <option value="">-- Wybierz zaplanowaną służbę --</option>
                {scheduledDuties.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dzień: {new Date(d.date).toLocaleDateString("pl-PL")} | Linia {d.line.number} {d.brigade ? `[${d.brigade}]` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  type="date"
                  name="dateStart"
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Wpisz datę służby, z której rezygnujesz.</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Powód rezygnacji ze służby *
            </label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="Wyjaśnij powód konieczności anulowania służby..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* STALY POJAZD: wniosek o staly pojazd i zmiana stalego pojazdu */}
      {type === "STALY_POJAZD" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wybierz preferowany stały pojazd z taboru *
            </label>
            <select
              name="details"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
            >
              <option value="">-- Wybierz autobus --</option>
              {availableVehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  #{veh.fleetNumber} - {veh.model} ({veh.registration}) [{veh.carrier}]
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Uzasadnienie / uwagi (opcjonalnie)
            </label>
            <textarea
              name="reason"
              rows={2}
              placeholder="np. Prośba o przypisanie stałego wozu na moje służby..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* ZMIANA ETATU: wniosek o zmiane etatu z limitem 6/7 */}
      {type === "ZMIANA_ETATU" && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Wybierz nowe dni etatu (maksymalnie 6/7) *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ETAT_DAYS.map((d) => {
              const active = selectedDays.includes(d.id);
              return (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => toggleDay(d.id)}
                  className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-between ${
                    active
                      ? "bg-amber-600/30 border-amber-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-400"
                  }`}
                >
                  <span>{d.label}</span>
                  <span>{active ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>

          {etatError && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 text-xs p-2 rounded">
              {etatError}
            </div>
          )}

          <div className="text-xs text-slate-400">
            Wybrano: <b className={selectedDays.length > 6 ? "text-red-400" : "text-emerald-400"}>{selectedDays.length}/7 dni</b>
          </div>

          <input type="hidden" name="details" value={selectedDays.join(",")} />
          <input type="hidden" name="reason" value={`Wniosek o zmianę etatu na dni: ${selectedDays.join(", ")}`} />
        </div>
      )}

      <button
        type="submit"
        disabled={type === "ZMIANA_ETATU" && selectedDays.length > 6}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg shadow transition-colors text-sm"
      >
        Wyślij wniosek do Zarządu
      </button>
    </form>
  );
}
