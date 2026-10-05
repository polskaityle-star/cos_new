"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dutyId = searchParams.get("dutyId");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [startMileage, setStartMileage] = useState("");
  const [endMileage, setEndMileage] = useState("");
  const [startScreen, setStartScreen] = useState("");
  const [endScreen, setEndScreen] = useState("");
  const [summaryFile, setSummaryFile] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!dutyId) {
      setError("Brak ID służby.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/panel/raport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dutyId,
          startMileage: parseInt(startMileage),
          endMileage: parseInt(endMileage),
          startScreenshot: startScreen,
          endScreenshot: endScreen,
          summaryFile: summaryFile
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Błąd podczas wysyłania raportu.");
      }

      router.push("/panel/kierowca");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Wystąpił nieoczekiwany błąd");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
      {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded">{error}</div>}
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Stan licznika (Start) [km]</label>
          <input type="number" required value={startMileage} onChange={e => setStartMileage(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500" />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Stan licznika (Koniec) [km]</label>
          <input type="number" required value={endMileage} onChange={e => setEndMileage(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Link do screena z pierwszego przystanku (np. Imgur)</label>
        <input type="url" required value={startScreen} onChange={e => setStartScreen(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500" placeholder="https://..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Link do screena z podsumowania (Ostatni przystanek)</label>
        <input type="url" required value={endScreen} onChange={e => setEndScreen(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500" placeholder="https://..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">Link do pliku .txt (Podsumowanie z OMSI)</label>
        <input type="url" required value={summaryFile} onChange={e => setSummaryFile(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500" placeholder="https://..." />
        <p className="text-xs text-slate-400">Możesz wrzucić plik tekstowy np. na Pastebin i wkleić tutaj link.</p>
      </div>

      <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow disabled:opacity-50 transition-colors">
        {loading ? "Wysyłanie..." : "Wyślij raport"}
      </button>
    </form>
  );
}

export default function ReportForm() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Złóż raport ze służby</h1>
      <Suspense fallback={<div className="text-center text-slate-400">Ładowanie formularza...</div>}>
        <ReportFormContent />
      </Suspense>
    </div>
  );
}
