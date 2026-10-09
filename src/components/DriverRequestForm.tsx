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
  canReinstate = false,
}: {
  scheduledDuties: ScheduledDuty[];
  availableVehicles: VehicleItem[];
  canReinstate?: boolean;
}) {
  const [type, setType] = useState<
    "URLOP" | "DODATKOWA_SLUZBA" | "ANULOWANIE_SLUZBY" | "STALY_POJAZD" | "ZMIANA_STALEGO_POJAZDU" | "USUNIECIE_STALEGO_POJAZDU" | "ZMIANA_ETATU" | "ODWIESZENIE"
  >(canReinstate ? "ODWIESZENIE" : "URLOP");
  const [selectedDays, setSelectedDays] = useState<string[]>(["PN", "WT", "SR", "CZ", "PT"]);
  const [etatError, setEtatError] = useState("");
  const [urlopStart, setUrlopStart] = useState("");
  const [urlopEnd, setUrlopEnd] = useState("");

  const getUrlopDays = () => {
    if (!urlopStart || !urlopEnd) return 0;
    const start = new Date(urlopStart);
    const end = new Date(urlopEnd);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return -1;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };
  const urlopDays = getUrlopDays();
  const isUrlopTooLong = urlopDays > 14;

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
          <option value="STALY_POJAZD">🚌 Wniosek o stały pojazd</option>
          <option value="ZMIANA_STALEGO_POJAZDU">🔄 Wniosek o zmianę stałego pojazdu</option>
          <option value="USUNIECIE_STALEGO_POJAZDU">🗑️ Wniosek o usunięcie stałego pojazdu (rezygnacja)</option>
          <option value="ZMIANA_ETATU">📅 Wniosek o zmianę etatu (dni pracy)</option>
          {canReinstate && (
            <option value="ODWIESZENIE">🔓 Wniosek o odwieszenie konta (po 10 niezaliczonych służbach)</option>
          )}
        </select>
      </div>

      {/* URLOP: max 14 dni */}
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
                value={urlopStart}
                onChange={(e) => setUrlopStart(e.target.value)}
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
                value={urlopEnd}
                onChange={(e) => setUrlopEnd(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
              />
            </div>
          </div>

          {urlopDays > 0 && (
            <div className={`p-2.5 rounded-lg border text-xs font-medium ${
              isUrlopTooLong
                ? "bg-red-950/70 border-red-500 text-red-200"
                : "bg-emerald-950/60 border-emerald-600/50 text-emerald-200"
            }`}>
              {isUrlopTooLong ? (
                <div>
                  <b className="block text-sm mb-1 text-red-300">⚠️ Wybrano {urlopDays} dni urlopu (maksymalnie 14 dni)!</b>
                  Zgodnie z regulaminem, urlop przez wniosek może wynosić maksymalnie 14 dni. Jeśli potrzebujesz dłuższego urlopu, napisz bezpośrednio wiadomość do Zarządu w sekcji Kontakt lub Wiadomości.
                </div>
              ) : (
                <div>
                  <span>Długość urlopu: <b className="text-white">{urlopDays} {urlopDays === 1 ? "dzień" : "dni"}</b> (maks. 14 dni).</span>
                </div>
              )}
            </div>
          )}

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

      {/* DODATKOWA SLUZBA: wybrany dzien, opcja wybrania pojazdu z taboru, usuniete uzasadnienie */}
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
              Preferowany pojazd z taboru (opcjonalnie)
            </label>
            <select
              name="vehicleId"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
            >
              <option value="">-- Bez preferencji pojazdu --</option>
              {availableVehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  #{veh.fleetNumber} - {veh.model} ({veh.registration}) [{veh.carrier}]
                </option>
              ))}
            </select>
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
          <input type="hidden" name="reason" value="Wniosek o dodatkową służbę" />
        </div>
      )}

      {/* ANULOWANIE SLUZBY: wybor sluzby z grafiku lub data */}
      {type === "ANULOWANIE_SLUZBY" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wybierz służbę z grafiku do anulowania *
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
                    Data: {new Date(d.date).toLocaleDateString("pl-PL")} | Linia {d.line.number} {d.brigade ? `[${d.brigade}]` : ""}
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
                <span className="text-[11px] text-amber-400 mt-1 block">Brak zaplanowanych służb w grafiku — podaj datę służby, z której rezygnujesz.</span>
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

      {/* STALY POJAZD: wniosek o przydzielenie stalego pojazdu */}
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
              placeholder="np. Prośba o przypisanie pierwszego stałego wozu..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* ZMIANA STALEGO POJAZDU: zmiana istniejacego wozu na inny */}
      {type === "ZMIANA_STALEGO_POJAZDU" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Wybierz nowy stały pojazd z taboru *
            </label>
            <select
              name="details"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm"
            >
              <option value="">-- Wybierz nowy autobus --</option>
              {availableVehicles.map((veh) => (
                <option key={veh.id} value={veh.id}>
                  #{veh.fleetNumber} - {veh.model} ({veh.registration}) [{veh.carrier}]
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Powód zmiany stałego pojazdu (opcjonalnie)
            </label>
            <textarea
              name="reason"
              rows={2}
              placeholder="np. Chcę przejść na autobus przegubowy lub nowszy model..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* USUNIECIE STALEGO POJAZDU: rezygnacja ze stalego wozu */}
      {type === "USUNIECIE_STALEGO_POJAZDU" && (
        <div className="space-y-4">
          <div className="bg-amber-950/40 border border-amber-600/50 p-4 rounded-lg text-amber-200 text-xs">
            <span className="font-bold block text-sm mb-1 text-white">⚠️ Potwierdzenie rezygnacji ze stałego pojazdu</span>
            Składasz wniosek o usunięcie przypisanego stałego autobusu. Po zaakceptowaniu wniosku przez Zarząd lub Sprawdzającego, powrócisz do puli pojazdów przydzielanych rotacyjnie.
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Uzasadnienie / uwagi (opcjonalnie)
            </label>
            <textarea
              name="reason"
              rows={2}
              placeholder="np. Rezygnacja ze stałego przydziału..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
          <input type="hidden" name="details" value="REZYGNACJA" />
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Powód zmiany etatu *
            </label>
            <textarea
              name="reason"
              required
              rows={2}
              placeholder="Podaj powód zmiany etatu (pole obowiązkowe)..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
        </div>
      )}

      {/* ODWIESZENIE: wniosek o odwieszenie konta po 10 niezaliczonych służbach */}
      {type === "ODWIESZENIE" && (
        <div className="space-y-4">
          <div className="bg-red-950/40 border border-red-600/50 p-4 rounded-lg text-red-200 text-xs">
            <span className="font-bold block text-sm mb-1 text-white">⚠️ Wniosek o odwieszenie konta kierowcy</span>
            Twoje konto zostało zawieszone z powodu 10 lub więcej niezaliczonych służb (Twój stały pojazd został zwolniony, etat pozostaje bez zmian). 
            Złóż poniższy wniosek, aby Zarząd lub Sprawdzający mógł odwiesić Twoje uprawnienia do realizowania służb.
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Uzasadnienie / Wyjaśnienie nieobecności *
            </label>
            <textarea
              name="reason"
              required
              rows={3}
              placeholder="Wyjaśnij przyczyny nieobecności i zadeklaruj chęć powrotu do jazdy..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-slate-100 text-sm resize-none"
            ></textarea>
          </div>
          <input type="hidden" name="details" value="ODWIESZENIE_KONTA" />
        </div>
      )}

      <button
        type="submit"
        disabled={(type === "ZMIANA_ETATU" && selectedDays.length > 6) || (type === "URLOP" && isUrlopTooLong)}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg shadow transition-colors text-sm cursor-pointer"
      >
        Wyślij wniosek do Zarządu
      </button>
    </form>
  );
}
