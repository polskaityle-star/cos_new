"use client";

import { useState } from "react";

const DAYS = [
  { id: "PN", label: "Poniedziałek" },
  { id: "WT", label: "Wtorek" },
  { id: "SR", label: "Środa" },
  { id: "CZ", label: "Czwartek" },
  { id: "PT", label: "Piątek" },
  { id: "SO", label: "Sobota" },
  { id: "ND", label: "Niedziela" },
];

export default function DriverEtatModal({ currentWorkingDays }: { currentWorkingDays?: string | null }) {
  const [isOpen, setIsOpen] = useState(!currentWorkingDays);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    currentWorkingDays ? currentWorkingDays.split(",").filter(Boolean) : ["PN", "WT", "SR", "CZ", "PT"]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleDay = (dayId: string) => {
    setError("");
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      const next = [...selectedDays, dayId];
      if (next.length >= 7) {
        setError("⚠️ Brak możliwości przekroczenia etatu 6/7! Nie możesz wybrać wszystkich 7 dni w tygodniu.");
      }
      setSelectedDays(next);
    }
  };

  const isExceeded = selectedDays.length > 6;
  const isTooFew = selectedDays.length === 0;

  const handleSubmit = async () => {
    if (isExceeded) {
      setError("⚠️ Brak możliwości przekroczenia etatu 6/7! Maksymalnie możesz wybrać 6 dni w tygodniu.");
      return;
    }
    if (isTooFew) {
      setError("Wybierz przynajmniej 1 dzień roboczy.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/panel/kierowca/etat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: selectedDays }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Błąd zapisu");

      setIsOpen(false);
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Błąd podczas zapisywania etatu");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-800 border-2 border-amber-500 rounded-2xl p-6 md:p-8 max-w-lg w-full space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="text-4xl">📅</div>
          <h2 className="text-2xl font-black text-amber-400">Wybierz Swój Etat</h2>
          <p className="text-sm text-slate-300">
            Jako zatwierdzony kierowca VZTM Kielce wybierz dni tygodnia, w których deklarujesz jazdę.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 text-xs p-3 rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400 px-1">
            <span>Dni w których jeździsz:</span>
            <span className={`font-mono text-sm ${isExceeded ? "text-red-400 font-bold" : "text-emerald-400"}`}>
              Wybrano: {selectedDays.length}/7 dni {isExceeded ? "(Przekroczono!)" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DAYS.map(d => {
              const checked = selectedDays.includes(d.id);
              return (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => toggleDay(d.id)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                    checked
                      ? "bg-amber-600/30 border-amber-500 text-white shadow"
                      : "bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <span>{d.label}</span>
                  <span>{checked ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>

          {selectedDays.length === 7 && (
            <div className="bg-amber-950/60 border border-amber-600/50 p-2.5 rounded-lg text-[11px] text-amber-200 text-center font-medium">
              ⚠️ Zgodnie z przepisami czasu pracy kierowcy: <b>brak możliwości przekroczenia etatu 6/7</b>. Odznacz co najmniej 1 dzień.
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={loading || isExceeded || isTooFew}
            onClick={handleSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold py-3 rounded-xl text-sm transition-colors shadow-lg"
          >
            {loading ? "Zapisywanie etatu..." : `Zatwierdź etat (${selectedDays.length}/7)`}
          </button>
        </div>
      </div>
    </div>
  );
}
