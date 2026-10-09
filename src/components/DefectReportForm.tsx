"use client";

import { useState } from "react";

interface VehicleOption {
  id: string;
  fleetNumber: string;
  model: string;
  carrier: string;
  registration: string;
}

// Pomocnicza kompresja zdjęć w canvas zapobiegająca błędowi 413 Payload Too Large
async function compressImageToDataUrl(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function DefectReportForm({
  availableVehicles,
  carrierLabel,
}: {
  availableVehicles: VehicleOption[];
  carrierLabel: string;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...filesArray]);

    filesArray.forEach((file) => {
      const url = URL.createObjectURL(file);
      setPreviews((prev) => [...prev, url]);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!vehicleId) {
      setError("Wybierz pojazd z listy.");
      return;
    }
    if (!title.trim()) {
      setError("Podaj tytuł zgłoszenia.");
      return;
    }
    if (!description.trim()) {
      setError("Wpisz dokładny opis uszkodzeń.");
      return;
    }
    if (selectedFiles.length === 0) {
      setError("Dodanie co najmniej jednego zdjęcia uszkodzenia jest obowiązkowe!");
      return;
    }

    setSubmitting(true);

    try {
      // Kompresja wszystkich zdjęć
      const compressedDataUrls = await Promise.all(
        selectedFiles.map((file) => compressImageToDataUrl(file))
      );

      const formData = new FormData();
      formData.append("vehicleId", vehicleId);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("photosJson", JSON.stringify(compressedDataUrls));

      const res = await fetch("/api/panel/kierowca/usterka", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = "Błąd podczas zgłaszania awarii.";
        try {
          const data = await res.json();
          msg = data.message || msg;
        } catch {
          const text = await res.text();
          if (text.includes("Request Entity Too Large") || res.status === 413) {
            msg = "Pliki zdjęć są za duże. Wybierz mniejsze zdjęcia.";
          }
        }
        throw new Error(msg);
      }

      window.location.href = "/panel/kierowca";
    } catch (err: any) {
      setError(err?.message || "Wystąpił nieoczekiwany błąd.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Pojazd z taboru ({carrierLabel}) *
        </label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          required
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100 text-sm"
        >
          <option value="">-- Wybierz pojazd --</option>
          {availableVehicles.map((veh) => (
            <option key={veh.id} value={veh.id}>
              #{veh.fleetNumber} - {veh.model} [{veh.carrier}] ({veh.registration})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Tytuł usterki / Co się stało? *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="np. Awaria drzwi II, Kolizja na skrzyżowaniu, Brak świateł"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Dokładny opis zdarzenia / uszkodzeń *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Opisz dokładnie kiedy i co się stało oraz jakie są uszkodzenia pojazdu..."
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 outline-none focus:border-rose-500 text-slate-100 resize-none text-sm"
        ></textarea>
      </div>

      {/* Zdjęcia uszkodzeń (obowiązkowe, wielokrotne) */}
      <div className="space-y-2 bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/80">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-rose-300">
            📷 Zdjęcia awarii / uszkodzeń (obowiązkowe, możesz wybrać kilka) *
          </label>
          <span className="text-[10px] text-slate-400">
            Wybrano: <b>{selectedFiles.length}</b>
          </span>
        </div>

        <input
          type="file"
          multiple
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleFilesChange}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-rose-700 file:text-white hover:file:bg-rose-600 cursor-pointer"
        />
        <p className="text-[11px] text-slate-400">
          Zrób i dołącz zrzuty ekranu lub zdjęcia uszkodzonych elementów pojazdu.
        </p>

        {/* Podgląd wybranych zdjęć */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
            {previews.map((src, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black">
                <img src={src} alt={`Zdjęcie ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow cursor-pointer"
                  title="Usuń to zdjęcie"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-lg shadow transition-colors cursor-pointer disabled:opacity-50 text-sm flex items-center justify-center gap-2"
      >
        <span>{submitting ? "Przetwarzanie i wysyłanie zdjęć..." : "🚨 Zgłoś usterkę do dyspozytorni"}</span>
      </button>
    </form>
  );
}
