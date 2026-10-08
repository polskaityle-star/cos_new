"use client";

import { useState } from "react";

interface ReportFileListProps {
  reportId: string;
  startScreenshot: string;
  endScreenshot: string;
  summaryFile: string;
}

export default function ReportFileList({
  reportId,
  startScreenshot,
  endScreenshot,
  summaryFile,
}: ReportFileListProps) {
  const [modalType, setModalType] = useState<"start" | "end" | "summary" | null>(null);
  const [summaryText, setSummaryText] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const startUrl = `/api/panel/zarzad/raporty/plik?reportId=${reportId}&type=start`;
  const endUrl = `/api/panel/zarzad/raporty/plik?reportId=${reportId}&type=end`;
  const summaryUrl = `/api/panel/zarzad/raporty/plik?reportId=${reportId}&type=summary`;

  const openSummaryModal = async () => {
    setModalType("summary");
    if (summaryFile.startsWith("data:")) {
      try {
        const commaIndex = summaryFile.indexOf(",");
        const raw = summaryFile.substring(commaIndex + 1);
        const decoded = atob(raw);
        setSummaryText(decoded);
        return;
      } catch {
        // fallback to fetch
      }
    }

    try {
      setLoadingSummary(true);
      const res = await fetch(summaryUrl);
      if (res.ok) {
        const text = await res.text();
        setSummaryText(text);
      } else {
        setSummaryText("Nie udało się załadować pliku podsumowania.");
      }
    } catch {
      setSummaryText("Błąd sieci podczas pobierania podsumowania.");
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm pt-2 border-t border-slate-800">
        {/* Screen Start */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded border border-slate-800">
          <button
            type="button"
            onClick={() => setModalType("start")}
            className="text-emerald-400 hover:text-emerald-300 font-medium text-xs flex items-center gap-1 flex-grow text-left"
          >
            <span>📷 Screen Start</span>
          </button>
          <a
            href={startUrl}
            target="_blank"
            rel="noreferrer"
            title="Otwórz w nowej karcie"
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
          >
            ↗
          </a>
        </div>

        {/* Screen Koniec */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded border border-slate-800">
          <button
            type="button"
            onClick={() => setModalType("end")}
            className="text-emerald-400 hover:text-emerald-300 font-medium text-xs flex items-center gap-1 flex-grow text-left"
          >
            <span>📷 Screen Koniec</span>
          </button>
          <a
            href={endUrl}
            target="_blank"
            rel="noreferrer"
            title="Otwórz w nowej karcie"
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
          >
            ↗
          </a>
        </div>

        {/* Podsumowanie OMSI (.txt) */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 p-2 rounded border border-slate-800">
          <button
            type="button"
            onClick={openSummaryModal}
            className="text-blue-400 hover:text-blue-300 font-medium text-xs flex items-center gap-1 flex-grow text-left"
          >
            <span>📄 Podsumowanie (.txt)</span>
          </button>
          <a
            href={summaryUrl}
            target="_blank"
            rel="noreferrer"
            title="Otwórz w nowej karcie"
            className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
          >
            ↗
          </a>
        </div>
      </div>

      {/* MODAL LIGHTBOX */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalType(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nagłówek modalu */}
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-white text-base">
                {modalType === "start" && "📷 Zrzut ekranu: Start służby"}
                {modalType === "end" && "📷 Zrzut ekranu: Koniec służby"}
                {modalType === "summary" && "📄 Podsumowanie kursu z OMSI 2"}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={modalType === "start" ? startUrl : modalType === "end" ? endUrl : summaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded transition-colors"
                >
                  Otwórz w nowej karcie ↗
                </a>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors"
                >
                  ✕ Zamknij
                </button>
              </div>
            </div>

            {/* Treść modalu */}
            <div className="p-4 overflow-auto flex-grow flex items-center justify-center bg-slate-950/60">
              {modalType === "start" && (
                <img
                  src={startScreenshot.startsWith("data:") ? startScreenshot : startUrl}
                  alt="Zrzut ekranu start"
                  className="max-h-[75vh] max-w-full object-contain rounded border border-slate-800"
                />
              )}

              {modalType === "end" && (
                <img
                  src={endScreenshot.startsWith("data:") ? endScreenshot : endUrl}
                  alt="Zrzut ekranu koniec"
                  className="max-h-[75vh] max-w-full object-contain rounded border border-slate-800"
                />
              )}

              {modalType === "summary" && (
                <div className="w-full">
                  {loadingSummary ? (
                    <div className="text-center py-10 text-slate-400">Ładowanie pliku tekstowego...</div>
                  ) : (
                    <pre className="w-full max-h-[70vh] overflow-auto bg-slate-950 p-4 rounded-lg font-mono text-xs text-emerald-400 whitespace-pre-wrap border border-slate-800 leading-relaxed select-text">
                      {summaryText || "Brak zawartości tekstowej."}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
