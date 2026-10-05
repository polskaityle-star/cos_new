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
  
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!dutyId) {
      setError("Brak ID służby.");
      setLoading(false);
      return;
    }

    if (!startFile || !endFile || !summaryFile) {
      setError("Wszystkie 3 pliki (screen start, screen koniec, podsumowanie .txt) są wymagane.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("dutyId", dutyId);
      formData.append("startMileage", startMileage);
      formData.append("endMileage", endMileage);
      formData.append("startScreenshotFile", startFile);
      formData.append("endScreenshotFile", endFile);
      formData.append("summaryDocFile", summaryFile);

      const res = await fetch("/api/panel/raport", {
        method: "POST",
        body: formData,
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
          <label className="text-sm font-medium text-slate-300">Stan licznika (Start) [km] *</label>
          <input
            type="number"
            required
            value={startMileage}
            onChange={e => setStartMileage(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white"
            placeholder="np. 125400"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Stan licznika (Koniec) [km] *</label>
          <input
            type="number"
            required
            value={endMileage}
            onChange={e => setEndMileage(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white"
            placeholder="np. 125445"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          📷 Screen z pierwszego przystanku (Start) [JPG, PNG] *
        </label>
        <input
          type="file"
          required
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={e => setStartFile(e.target.files?.[0] || null)}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-600"
        />
        <p className="text-xs text-slate-400">Wyraźny zrzut ekranu pulpitu/autobusu na przystanku początkowym.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          📷 Screen z podsumowania / ostatniego przystanku (Koniec) [JPG, PNG] *
        </label>
        <input
          type="file"
          required
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={e => setEndFile(e.target.files?.[0] || null)}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-600"
        />
        <p className="text-xs text-slate-400">Zrzut ekranu z końcowego przystanku lub ekranu podsumowania trasy.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          📄 Plik podsumowania z OMSI (.txt) *
        </label>
        <input
          type="file"
          required
          accept=".txt, text/plain"
          onChange={e => setSummaryFile(e.target.files?.[0] || null)}
          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-600"
        />
        <p className="text-xs text-slate-400">Plik wygenerowany przez OMSI 2 lub zrzut logu ze służby.</p>
      </div>

      <button
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow disabled:opacity-50 transition-colors"
      >
        {loading ? "Wysyłanie plików raportu..." : "Wyślij raport ze służby"}
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
