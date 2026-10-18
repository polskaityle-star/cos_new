"use client";

import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Błąd podczas wysyłania wiadomości");
      }

      setSuccess("Twoja wiadomość została pomyślnie wysłana do Zarządu!");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
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
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold mb-6 text-center">Kontakt z Zarządem</h1>
      
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
        {success && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-200 p-4 rounded-lg mb-6 text-center font-medium">
            ✅ {success}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded-lg mb-6 text-center font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-300">Imię / Nick *</label>
              <input
                type="text"
                id="name"
                required
                maxLength={60}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="Twój nick"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">Adres e-mail</label>
              <input
                type="email"
                id="email"
                maxLength={120}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="twoj@e-mail.com (opcjonalnie)"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium text-slate-300">Temat *</label>
            <input
              type="text"
              id="subject"
              required
              maxLength={150}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="W jakiej sprawie piszesz?"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium text-slate-300">Wiadomość *</label>
            <textarea
              id="message"
              rows={5}
              required
              maxLength={2000}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
              placeholder="Twoja wiadomość..."
            ></textarea>
            <div className="flex justify-end text-xs text-slate-400 font-mono">
              <span>{message.length}/2000</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors disabled:opacity-50"
          >
            {loading ? "Wysyłanie..." : "Wyślij wiadomość do Zarządu"}
          </button>
        </form>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 mt-12">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
          <h3 className="font-bold text-xl mb-2 text-[#E31837]">Zarząd VMPK</h3>
          <a
            href="mailto:vmpk@vztm-kielce.pl"
            className="text-slate-400 hover:text-white transition-colors underline"
          >
            vmpk@vztm-kielce.pl
          </a>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
          <h3 className="font-bold text-xl mb-2 text-[#005A9C]">Zarząd VBP</h3>
          <a
            href="mailto:vbp@vztm-kielce.pl"
            className="text-slate-400 hover:text-white transition-colors underline"
          >
            vbp@vztm-kielce.pl
          </a>
        </div>
      </div>
    </div>
  );
}
