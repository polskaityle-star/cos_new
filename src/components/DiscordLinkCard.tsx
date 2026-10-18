"use client";

import { useEffect, useState } from "react";
import DiscordMessageForm from "@/components/DiscordMessageForm";

interface DiscordState {
  enabled: boolean;
  botEnabled: boolean;
  webhookEnabled: boolean;
  linked: boolean;
  username: string | null;
  notify: boolean;
  canSync: boolean;
}

const FLAGS: Record<string, { text: string; ok: boolean }> = {
  linked: { text: "Konto Discord zostało powiązane.", ok: true },
  cancelled: { text: "Anulowano łączenie z Discordem.", ok: false },
  taken: { text: "To konto Discord jest już powiązane z innym użytkownikiem.", ok: false },
  error: { text: "Nie udało się powiązać konta Discord. Spróbuj ponownie.", ok: false },
};

export default function DiscordLinkCard() {
  const [state, setState] = useState<DiscordState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(() => {
    if (typeof window === "undefined") return null;
    const flag = new URLSearchParams(window.location.search).get("discord");
    return flag && FLAGS[flag] ? FLAGS[flag] : null;
  });

  const load = async () => {
    try {
      const res = await fetch("/api/discord/me", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* brak integracji - karta się nie wyświetli */
    }
  };

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("discord");
    if (flag && FLAGS[flag]) {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
    let ignore = false;
    fetch("/api/discord/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !ignore) setState(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  if (!state || (!state.enabled && !state.webhookEnabled && !state.linked)) return null;

  const unlink = async () => {
    if (!confirm("Odłączyć konto Discord? Przestaniesz dostawać powiadomienia i stracisz role na serwerze.")) return;
    setBusy(true);
    await fetch("/api/discord/unlink", { method: "POST" });
    await load();
    setBusy(false);
  };

  const toggleNotify = async () => {
    setBusy(true);
    await fetch("/api/discord/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notify: !state.notify }),
    });
    await load();
    setBusy(false);
  };

  const syncMe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/discord/sync-me", { method: "POST" });
      const data = await res.json();
      setMsg({
        text: data.message || (res.ok ? "Role zostały zsynchronizowane." : "Błąd synchronizacji ról."),
        ok: res.ok,
      });
    } catch {
      setMsg({ text: "Błąd połączenia podczas synchronizacji ról.", ok: false });
    }
    setBusy(false);
  };

  const registerCommands = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel/zarzad/discord-commands", { method: "POST" });
      const data = await res.json();
      setMsg({
        text: data.message || (res.ok ? "Zarejestrowano komendy na Discordzie." : "Błąd rejestracji komend."),
        ok: res.ok,
      });
    } catch {
      setMsg({ text: "Błąd połączenia podczas rejestracji komend.", ok: false });
    }
    setBusy(false);
  };

  const syncAll = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/panel/zarzad/discord-sync", { method: "POST" });
      const data = await res.json();
      setMsg(
        res.ok
          ? { text: `Zsynchronizowano role: ${data.synced}/${data.total} powiązanych kont.`, ok: true }
          : { text: data.message || "Błąd synchronizacji.", ok: false }
      );
    } catch {
      setMsg({ text: "Błąd synchronizacji.", ok: false });
    }
    setBusy(false);
  };

  return (
    <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#5865F2]" /> Discord
          </h2>
          {state.linked ? (
            <p className="text-sm text-slate-300">
              Powiązano z kontem <b className="text-white">{state.username || "Discord"}</b>. Powiadomienia prywatne:{" "}
              <b className={state.notify ? "text-emerald-400" : "text-slate-400"}>{state.notify ? "włączone" : "wyłączone"}</b>.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              Powiąż konto, aby dostawać wiadomości prywatne (wnioski, grafik, raporty), logować się przez Discord i używać komend bota
              (<code>/panel</code>, <code>/raport</code>, <code>/usterka</code>, <code>/wniosek</code>, <code>/grafik</code>).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {state.linked ? (
            <>
              <button
                onClick={syncMe}
                disabled={busy}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold border border-indigo-500/60 disabled:opacity-50 cursor-pointer shadow-xs"
                title="Przypisz aktualną rolę i przewoźnika do swojego konta na Discordzie"
              >
                🔄 Nadaj/Zaktualizuj role na DC
              </button>
              <button
                onClick={toggleNotify}
                disabled={busy}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-600 disabled:opacity-50 cursor-pointer"
              >
                {state.notify ? "Wyłącz powiadomienia DM" : "Włącz powiadomienia DM"}
              </button>
              <button
                onClick={unlink}
                disabled={busy}
                className="bg-red-900/60 hover:bg-red-800 text-red-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-red-700/60 disabled:opacity-50 cursor-pointer"
              >
                Odłącz
              </button>
            </>
          ) : (
            <a
              href="/api/discord/link/start"
              className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-lg text-xs font-bold shadow"
            >
              Połącz z Discordem
            </a>
          )}
          {state.canSync && (
            <>
              <button
                onClick={registerCommands}
                disabled={busy}
                className="bg-purple-700/80 hover:bg-purple-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold border border-purple-500/60 disabled:opacity-50 cursor-pointer shadow-xs"
                title="Zarejestruj komendy /panel, /raport, /usterka, /wniosek w API Discorda"
              >
                ⚡ Aktywuj/Odśwież komendy bota na DC
              </button>
              <button
                onClick={syncAll}
                disabled={busy}
                className="bg-amber-700/80 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold border border-amber-600/60 disabled:opacity-50 cursor-pointer"
              >
                Synchronizuj role na serwerze
              </button>
            </>
          )}
        </div>
      </div>

      {state.linked && !state.botEnabled && (
        <p className="text-xs text-amber-300">Bot nie jest skonfigurowany - wiadomości prywatne nie będą wysyłane.</p>
      )}
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>
      )}

      {/* Formularz wysyłania wiadomości na Discord */}
      <div className="pt-2 border-t border-slate-700/60">
        <DiscordMessageForm isManagement={state.canSync} />
      </div>
    </section>
  );
}
