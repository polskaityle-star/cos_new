"use client";

import { useState } from "react";

interface DiscordMessageFormProps {
  defaultChannel?: "WIADOMOSCI" | "GRAFIK" | "USTERKI" | "RAPORTY" | "REKRUTACJA" | "KONTAKT";
  isManagement?: boolean;
}

const CHANNELS: { id: "WIADOMOSCI" | "GRAFIK" | "USTERKI" | "RAPORTY" | "REKRUTACJA" | "KONTAKT"; label: string }[] = [
  { id: "WIADOMOSCI", label: "💬 Wiadomości / Ogłoszenia" },
  { id: "GRAFIK", label: "📅 Dyspozytornia / Grafik służb" },
  { id: "USTERKI", label: "🛠️ Usterki i Warsztat" },
  { id: "RAPORTY", label: "📊 Raporty ze służb" },
  { id: "REKRUTACJA", label: "📝 Rekrutacja i Podania" },
  { id: "KONTAKT", label: "📩 Wiadomości kontaktowe" },
];

export default function DiscordMessageForm({
  defaultChannel = "WIADOMOSCI",
  isManagement = false,
}: DiscordMessageFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState(defaultChannel);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/discord/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, title, content }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setResult({ ok: true, msg: data.message || "Wiadomość została wysłana na Discord!" });
        setContent("");
        setTitle("");
      } else {
        setResult({ ok: false, msg: data.message || "Nie udało się wysłać wiadomości na Discord." });
      }
    } catch {
      setResult({ ok: false, msg: "Błąd połączenia z serwerem." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📢</span>
          <span className="text-sm font-bold text-white">Wyślij wiadomość na Discord</span>
          <span className="text-[10px] bg-[#5865F2]/20 text-[#858ff8] border border-[#5865F2]/40 px-2 py-0.5 rounded-full font-mono">
            Webhook API
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md border border-slate-600 transition-colors cursor-pointer"
        >
          {isOpen ? "Zwiń formularz ▲" : "Otwórz formularz ▼"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Wybierz kanał docelowy
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {CHANNELS.filter((ch) => isManagement || ch.id === "WIADOMOSCI" || ch.id === "GRAFIK").map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tytuł wiadomości (opcjonalny)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Ważny komunikat dyspozytorni"
                maxLength={120}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-semibold text-slate-300">
                Treść wiadomości *
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {content.length}/2000
              </span>
            </div>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Wpisz treść wiadomości, która ma zostać natychmiast opublikowana na serwerze Discord..."
              maxLength={2000}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-y"
            />
          </div>

          {result && (
            <div
              className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                result.ok
                  ? "bg-emerald-950/80 border border-emerald-600 text-emerald-200"
                  : "bg-red-950/80 border border-red-600 text-red-200"
              }`}
            >
              <span>{result.ok ? "✅" : "⚠️"}</span>
              <span>{result.msg}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer"
            >
              <span>{sending ? "⏳ Wysyłanie..." : "🚀 Wyślij na Discord"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
