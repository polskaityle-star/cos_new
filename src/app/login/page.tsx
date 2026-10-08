"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (res?.error) {
        if (res.error.toLowerCase().includes("pending") || res.error.toLowerCase().includes("approval") || res.error.toLowerCase().includes("reject")) {
          setError("Twoje konto oczekuje na zatwierdzenie przez Zarząd lub zostało odrzucone.");
        } else {
          setError("Nieprawidłowa nazwa użytkownika lub hasło.");
        }
        setLoading(false);
      } else {
        // Sprawdź rolę i wykonaj pełne przekierowanie
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData?.user?.role === "ZARZAD") {
            window.location.href = "/panel/zarzad";
            return;
          }
        } catch {
          // ignore error and proceed
        }
        window.location.href = "/panel/kierowca";
      }
    } catch {
      setError("Wystąpił błąd podczas logowania. Spróbuj ponownie.");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-10">
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Logowanie</h1>

        {/* Pomocnicze domyślne dane logowania */}
        <div className="bg-slate-900/90 border border-slate-700 p-3.5 rounded-lg text-xs text-slate-300 mb-5 space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-bold text-amber-400 block">Konto Administratora:</span>
              Login: <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">admin</code> | Hasło: <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">admin123</code>
            </div>
            <button
              type="button"
              onClick={() => { setUsername("admin"); setPassword("admin123"); }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
            >
              Uzupełnij
            </button>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-800">
            <div>
              <span className="font-bold text-emerald-400 block">Konto Kierowcy:</span>
              Login: <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">kierowca1</code> | Hasło: <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">kierowca123</code>
            </div>
            <button
              type="button"
              onClick={() => { setUsername("kierowca1"); setPassword("kierowca123"); }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
            >
              Uzupełnij
            </button>
          </div>
        </div>
        
        {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-center text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Nazwa Użytkownika / Nick</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white" />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-slate-300">Hasło</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white" />
          </div>

          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded shadow transition-colors disabled:opacity-50">
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Nie masz konta? <a href="/register" className="text-emerald-400 hover:underline">Złóż wniosek (Zarejestruj się)</a>
        </div>
      </div>
    </div>
  );
}
