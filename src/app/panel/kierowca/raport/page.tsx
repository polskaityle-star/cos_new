"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface DutyInfo {
  id: string;
  date: string;
  shift: string | null;
  brigade: string | null;
  line: { number: string };
  vehicle: { fleetNumber: string; model: string; mileage: number } | null;
}

// Kompresja obrazów po stronie klienta za pomocą HTML5 Canvas
// Chroni przed błędem 413 "Request Entity Too Large"
async function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, ".jpg"),
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }
              );
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      } else {
        resolve(file);
      }
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

function ReportFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dutyId = searchParams.get("dutyId");

  const [loading, setLoading] = useState(false);
  const [loadingDuty, setLoadingDuty] = useState(true);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");

  const [duty, setDuty] = useState<DutyInfo | null>(null);

  // Zmiana / typ służby: "ZMIANA_1" | "ZMIANA_2" | "SZCZYTOWA"
  const [shiftMode, setShiftMode] = useState<"ZMIANA_1" | "ZMIANA_2" | "SZCZYTOWA">("ZMIANA_1");

  const [startMileage, setStartMileage] = useState("");
  const [endMileage, setEndMileage] = useState("");

  // Wymagane pliki podstawowe
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);

  // Opcjonalne screeny z zajezdni wg Wymogu 10
  const [depotDep1File, setDepotDep1File] = useState<File | null>(null);
  const [depotArr1File, setDepotArr1File] = useState<File | null>(null);
  const [depotDep2File, setDepotDep2File] = useState<File | null>(null);
  const [depotArr2File, setDepotArr2File] = useState<File | null>(null);

  useEffect(() => {
    if (!dutyId) {
      setLoadingDuty(false);
      return;
    }

    fetch(`/api/panel/raport?dutyId=${dutyId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.duty) {
          setDuty(data.duty);
          const d = data.duty;
          const brig = (d.brigade || "").toLowerCase();
          const sh = (d.shift || "").toLowerCase();

          if (brig.includes("szczyt") || sh.includes("szczyt")) {
            setShiftMode("SZCZYTOWA");
          } else if (sh.includes("2") || brig.includes("/2") || brig.includes("2 zmiana")) {
            setShiftMode("ZMIANA_2");
          } else {
            setShiftMode("ZMIANA_1");
          }

          if (d.vehicle?.mileage) {
            setStartMileage(String(d.vehicle.mileage));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDuty(false));
  }, [dutyId]);

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
      setError("Wszystkie 3 podstawowe pliki (screen start, screen koniec, podsumowanie .txt) są wymagane.");
      setLoading(false);
      return;
    }

    try {
      setCompressing(true);

      // Automatyczna kompresja screenów po stronie przeglądarki przed wysłaniem
      const [compressedStart, compressedEnd] = await Promise.all([
        compressImage(startFile),
        compressImage(endFile),
      ]);

      const formData = new FormData();
      formData.append("dutyId", dutyId);
      formData.append("startMileage", startMileage);
      formData.append("endMileage", endMileage);
      formData.append("startScreenshotFile", compressedStart);
      formData.append("endScreenshotFile", compressedEnd);
      formData.append("summaryDocFile", summaryFile);

      // Opcjonalne screeny z zajezdni (Wymóg 10)
      if (shiftMode === "ZMIANA_1" && depotDep1File) {
        const comp = await compressImage(depotDep1File);
        formData.append("depotDep1File", comp);
      } else if (shiftMode === "ZMIANA_2" && depotArr1File) {
        const comp = await compressImage(depotArr1File);
        formData.append("depotArr1File", comp);
      } else if (shiftMode === "SZCZYTOWA") {
        if (depotDep1File) formData.append("depotDep1File", await compressImage(depotDep1File));
        if (depotArr1File) formData.append("depotArr1File", await compressImage(depotArr1File));
        if (depotDep2File) formData.append("depotDep2File", await compressImage(depotDep2File));
        if (depotArr2File) formData.append("depotArr2File", await compressImage(depotArr2File));
      }

      setCompressing(false);

      const res = await fetch("/api/panel/raport", {
        method: "POST",
        body: formData,
      });

      // Bezpieczny odczyt odpowiedzi zabezpieczający przed HTML/413 "Request Entity Too Large"
      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // Odpowiedź serwera nie była JSON-em (np. błąd limitu rozmiaru serwera)
      }

      if (!res.ok) {
        if (res.status === 413 || resText.includes("Request Entity Too Large")) {
          throw new Error("Pliki są zbyt duże dla serwera. Spróbuj wybrać mniejsze zrzuty ekranu.");
        }
        throw new Error(resJson?.message || `Błąd serwera (${res.status}): ${resText.slice(0, 100)}`);
      }

      router.push("/panel/kierowca");
      router.refresh();
    } catch (err: unknown) {
      setCompressing(false);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Wystąpił nieoczekiwany błąd podczas wysyłania raportu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-6">
      {/* Informacje o służbie */}
      {duty && (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white">Linia {duty.line.number}</span>
              {duty.brigade && (
                <span className="bg-amber-900/50 text-amber-300 border border-amber-600/40 px-2 py-0.5 rounded font-mono text-xs">
                  {duty.brigade}
                </span>
              )}
              {duty.vehicle && (
                <span className="bg-blue-900/50 text-blue-300 border border-blue-600/40 px-2 py-0.5 rounded text-xs font-bold">
                  🚌 #{duty.vehicle.fleetNumber} ({duty.vehicle.model})
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Data służby: {new Date(duty.date).toLocaleDateString("pl-PL")} &bull; Zmiana w grafiku: {duty.shift || "Standardowa"}
            </div>
          </div>
          <Link
            href="/panel/kierowca"
            className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
          >
            &larr; Wróć do panelu
          </Link>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-3.5 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Wybór typu zmiany dla screenów z zajezdni (Wymóg 10) */}
      <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-700 space-y-2">
        <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider">
          ⚙️ Typ brygady i zmiany (dla screenów z zajezdni):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setShiftMode("ZMIANA_1")}
            className={`px-3 py-2 rounded-lg text-xs font-bold text-left border transition ${
              shiftMode === "ZMIANA_1"
                ? "bg-amber-600 border-amber-500 text-white shadow"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            <div>1 Zmiana (Wyjazd)</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Tylko screen z wyjazdu</div>
          </button>

          <button
            type="button"
            onClick={() => setShiftMode("ZMIANA_2")}
            className={`px-3 py-2 rounded-lg text-xs font-bold text-left border transition ${
              shiftMode === "ZMIANA_2"
                ? "bg-amber-600 border-amber-500 text-white shadow"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            <div>2 Zmiana (Zjazd)</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Tylko screen ze zjazdu</div>
          </button>

          <button
            type="button"
            onClick={() => setShiftMode("SZCZYTOWA")}
            className={`px-3 py-2 rounded-lg text-xs font-bold text-left border transition ${
              shiftMode === "SZCZYTOWA"
                ? "bg-purple-600 border-purple-500 text-white shadow"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            <div>⚡ Brygada Szczytowa</div>
            <div className="text-[10px] font-normal opacity-80 mt-0.5">Podwójny wyjazd i zjazd</div>
          </button>
        </div>
      </div>

      {/* Liczniki kilometrów */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Stan licznika (Start) [km] *</label>
          <input
            type="number"
            required
            value={startMileage}
            onChange={(e) => setStartMileage(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white text-sm"
            placeholder="np. 125400"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Stan licznika (Koniec) [km] *</label>
          <input
            type="number"
            required
            value={endMileage}
            onChange={(e) => setEndMileage(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white text-sm"
            placeholder="np. 125445"
          />
        </div>
      </div>

      {/* Podstawowe obowiązkowe pliki */}
      <div className="space-y-4 pt-2 border-t border-slate-700">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          📸 Obowiązkowe pliki raportu (z trasy):
        </h3>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">
            📷 Screen z pierwszego przystanku (Start) [JPG, PNG] *
          </label>
          <input
            type="file"
            required
            accept="image/png, image/jpeg, image/jpg, image/webp"
            onChange={(e) => setStartFile(e.target.files?.[0] || null)}
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
            onChange={(e) => setEndFile(e.target.files?.[0] || null)}
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
            onChange={(e) => setSummaryFile(e.target.files?.[0] || null)}
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-600"
          />
          <p className="text-xs text-slate-400">Plik wygenerowany przez OMSI 2 lub zrzut logu ze służby.</p>
        </div>
      </div>

      {/* Opcjonalne screeny z wyjazdu i zjazdu do zajezdni (Wymóg 10, 10.1, 10.2, 10.3) */}
      <div className="space-y-4 pt-4 border-t border-slate-700 bg-slate-900/50 p-4 rounded-xl border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
            <span>🏢 Zrzuty ekranu z zajezdni (opcjonalne)</span>
          </h3>
          <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {shiftMode === "ZMIANA_1" && "Zmiana 1: Tylko wyjazd"}
            {shiftMode === "ZMIANA_2" && "Zmiana 2: Tylko zjazd"}
            {shiftMode === "SZCZYTOWA" && "Szczytowa: 2x wyjazd i zjazd"}
          </span>
        </div>

        {/* 10.1: Zmiana 1 - tylko opcja dodania screenshota z wyjazdu z zajezdni */}
        {shiftMode === "ZMIANA_1" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              📷 Zrzut ekranu: Wyjazd z zajezdni (opcjonalny)
            </label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={(e) => setDepotDep1File(e.target.files?.[0] || null)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-amber-700 file:text-white"
            />
            <p className="text-[11px] text-slate-400">Dodaj zdjęcie autobusu przed bramą wyjazdową z zajezdni.</p>
          </div>
        )}

        {/* 10.2: Zmiana 2 - tylko opcja dodania screenshota ze zjazdu do zajezdni */}
        {shiftMode === "ZMIANA_2" && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              📷 Zrzut ekranu: Zjazd do zajezdni (opcjonalny)
            </label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={(e) => setDepotArr1File(e.target.files?.[0] || null)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-amber-700 file:text-white"
            />
            <p className="text-[11px] text-slate-400">Dodaj zdjęcie autobusu po zjeździe na plac zajezdni.</p>
          </div>
        )}

        {/* 10.3: Brygada szczytowa - wyjazd z zajezdni i zjazd do zajezdni podwójnie */}
        {shiftMode === "SZCZYTOWA" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-xs font-bold text-purple-300 block">I Wyjazd / Zjazd:</span>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">📷 I Wyjazd z zajezdni (opcjonalny)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => setDepotDep1File(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-purple-700 file:text-white"
                />
              </div>
              <div className="pt-1.5">
                <label className="text-[11px] text-slate-300 block mb-1">📷 I Zjazd do zajezdni (opcjonalny)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => setDepotArr1File(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-purple-700 file:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-xs font-bold text-purple-300 block">II Wyjazd / Zjazd:</span>
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">📷 II Wyjazd z zajezdni (opcjonalny)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => setDepotDep2File(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-purple-700 file:text-white"
                />
              </div>
              <div className="pt-1.5">
                <label className="text-[11px] text-slate-300 block mb-1">📷 II Zjazd do zajezdni (opcjonalny)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => setDepotArr2File(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-purple-700 file:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || compressing}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
      >
        {compressing ? (
          <span>⚡ Optymalizacja i kompresja zdjęć...</span>
        ) : loading ? (
          <span>Wysyłanie raportu na serwer...</span>
        ) : (
          <span>🚀 Wyślij raport ze służby</span>
        )}
      </button>
    </form>
  );
}

export default function ReportForm() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Złóż raport ze służby</h1>
          <p className="text-sm text-slate-400 mt-1">
            Uzupełnij stan licznika i załącz wymagane zrzuty ekranu oraz plik z OMSI 2.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="text-center py-10 text-slate-400">Ładowanie formularza raportu...</div>}>
        <ReportFormContent />
      </Suspense>
    </div>
  );
}
