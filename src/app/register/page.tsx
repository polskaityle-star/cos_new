"use client";

import { useState } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [carrier, setCarrier] = useState("VMPK");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          carrier,
          age: age ? parseInt(age, 10) : null,
          bio,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Błąd rejestracji");
      }

      setSuccess(data.message || "Wniosek został złożony! Poczekaj na akceptację przez Zarząd, zanim się zalogujesz.");
      setUsername("");
      setPassword("");
      setAge("");
      setBio("");
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
    <div className="flex justify-center items-center py-8">
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-2 text-center">Rekrutacja (Wniosek o pracę)</h1>
        <p className="text-xs text-slate-400 text-center mb-6">
          Dołącz do zespołu VZTM Kielce. Po złożeniu wniosku system przydzieli Ci unikalny numer służbowy.
        </p>
        
        {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-center text-sm">{error}</div>}
        {success && <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-200 p-3 rounded mb-4 text-center text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Wymarzony Nick w firmie *</label>
            <input
              type="text"
              required
              placeholder="np. Janek_Kielce"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Hasło do panelu *</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 znaków"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Wybierz przewoźnika *</label>
              <select
                value={carrier}
                onChange={e => setCarrier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              >
                <option value="VMPK">VMPK Kielce</option>
                <option value="VBP">VBP Tour Regio</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Wiek (w latach) *</label>
              <input
                type="number"
                min="13"
                max="99"
                required
                placeholder="np. 18"
                value={age}
                onChange={e => setAge(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Powiedz coś o sobie *</label>
            <textarea
              required
              rows={3}
              placeholder="Doświadczenie w OMSI 2, ulubione linie, dlaczego chcesz dołączyć do VZTM Kielce..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />
          </div>

          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded shadow transition-colors disabled:opacity-50">
            {loading ? "Wysyłanie wniosku..." : "Złóż Wniosek o Pracę"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Masz już konto? <a href="/login" className="text-emerald-400 hover:underline">Zaloguj się</a>
        </div>
      </div>
    </div>
  );
}
