"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "changePassword">("login");

  // Stan logowania
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Stan zmiany hasła (Wymóg 10)
  const [cpUsername, setCpUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpSuccess, setCpSuccess] = useState("");
  const [cpError, setCpError] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

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
        if (
          res.error.toLowerCase().includes("pending") ||
          res.error.toLowerCase().includes("approval") ||
          res.error.toLowerCase().includes("reject")
        ) {
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
          const role = sessionData?.user?.role;
          const managementRoles = [
            "WLASCICIEL",
            "ZARZAD",
            "DYSPOZYTOR",
            "KIEROWNIK_PRZEWOZOW",
            "MECHANIK",
            "SPRAWDZAJACY",
          ];
          if (managementRoles.includes(role)) {
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpLoading(true);
    setCpError("");
    setCpSuccess("");

    if (newPassword !== confirmPassword) {
      setCpError("Nowe hasła nie są identyczne.");
      setCpLoading(false);
      return;
    }

    if (newPassword.length < 4) {
      setCpError("Nowe hasło musi zawierać co najmniej 4 znaki.");
      setCpLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cpUsername,
          oldPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCpError(data.message || "Błąd podczas zmiany hasła.");
      } else {
        setCpSuccess(data.message || "Hasło zmienione pomyślnie! Możesz się teraz zalogować.");
        setUsername(cpUsername);
        setPassword("");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setActiveTab("login");
        }, 1800);
      }
    } catch {
      setCpError("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    } finally {
      setCpLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center py-10">
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-xl w-full max-w-md">
        {/* Zakładki: Logowanie / Zmiana hasła */}
        <div className="flex border-b border-slate-700 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-2.5 text-center font-bold text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === "login"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🔑 Logowanie
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("changePassword")}
            className={`flex-1 py-2.5 text-center font-bold text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === "changePassword"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🔄 Zmiana hasła
          </button>
        </div>

        {activeTab === "login" ? (
          <>
            <h1 className="text-2xl font-bold mb-4 text-center text-white">Logowanie do Portalu</h1>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-center text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Nazwa Użytkownika / Nick</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white text-sm"
                  placeholder="np. Godksawiss lub Twój nick"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-slate-300">Hasło</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCpUsername(username);
                      setActiveTab("changePassword");
                    }}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    Zmień hasło?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-emerald-500 text-white text-sm"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded shadow transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-4 text-center text-white">Zmiana Hasła</h1>

            {cpError && (
              <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-center text-sm">
                {cpError}
              </div>
            )}

            {cpSuccess && (
              <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-200 p-3 rounded mb-4 text-center text-sm">
                {cpSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Nazwa Użytkownika / Nick *</label>
                <input
                  type="text"
                  required
                  value={cpUsername}
                  onChange={(e) => setCpUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-amber-500 text-white text-sm"
                  placeholder="Twój login w systemie"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Dotychczasowe hasło *</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-amber-500 text-white text-sm"
                  placeholder="Wpisz obecne hasło"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Nowe hasło *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-amber-500 text-white text-sm"
                  placeholder="Minimum 4 znaki"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Powtórz nowe hasło *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 outline-none focus:border-amber-500 text-white text-sm"
                  placeholder="Wpisz ponownie nowe hasło"
                />
              </div>

              <button
                type="submit"
                disabled={cpLoading}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded shadow transition-colors disabled:opacity-50 cursor-pointer text-sm"
              >
                {cpLoading ? "Zmienianie hasła..." : "Zatwierdź nowe hasło"}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center text-sm text-slate-400">
          Nie masz konta?{" "}
          <a href="/register" className="text-emerald-400 hover:underline">
            Złóż wniosek (Zarejestruj się)
          </a>
        </div>
      </div>
    </div>
  );
}
