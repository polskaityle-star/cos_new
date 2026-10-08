"use client";

import { useState } from "react";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
];

export default function AvatarManager({ currentAvatar, username }: { currentAvatar?: string | null; username: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatar || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Maksymalny rozmiar pliku to 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!avatarUrl) return;
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/panel/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: avatarUrl }),
      });

      if (!res.ok) throw new Error("Błąd zapisu");
      setMessage("Zapisano zdjęcie profilowe!");
      setTimeout(() => {
        setIsOpen(false);
        window.location.reload();
      }, 600);
    } catch {
      setMessage("Wystąpił błąd podczas zapisywania.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setIsOpen(true)}>
        {currentAvatar ? (
          <img
            src={currentAvatar}
            alt={username}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-amber-400 shadow-md group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center text-xl font-bold text-amber-400 group-hover:border-amber-400 transition-colors">
            {username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-0 right-0 bg-amber-500 text-slate-900 rounded-full p-1 text-[10px] shadow" title="Zmień zdjęcie">
          📷
        </span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-white">Zmień zdjęcie profilowe</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
            </div>

            {message && (
              <div className="text-xs p-2.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-center font-medium">
                {message}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Podgląd" className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500 shadow-lg" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-3xl text-slate-500">
                  👤
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Prześlij zdjęcie z komputera (max 2MB):</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Lub wklej bezpośredni link (URL):</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2.5 py-1.5 text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Lub wybierz gotowy avatar:</label>
                <div className="flex gap-2 justify-center py-1">
                  {PRESET_AVATARS.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Preset ${i}`}
                      onClick={() => setAvatarUrl(url)}
                      className={`w-10 h-10 rounded-full object-cover cursor-pointer border-2 transition-transform hover:scale-110 ${avatarUrl === url ? "border-amber-400 scale-105" : "border-transparent"}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={loading || !avatarUrl}
                onClick={handleSave}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow"
              >
                {loading ? "Zapisywanie..." : "Zapisz avatar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
