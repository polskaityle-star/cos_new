export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold mb-6 text-center">Kontakt</h1>
      
      <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
        <form className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-300">Imię / Nick</label>
              <input type="text" id="name" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all" placeholder="Twój nick" />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">Adres Email</label>
              <input type="email" id="email" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all" placeholder="twoj@email.com" />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium text-slate-300">Temat</label>
            <input type="text" id="subject" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all" placeholder="W jakiej sprawie piszesz?" />
          </div>

          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium text-slate-300">Wiadomość</label>
            <textarea id="message" rows={5} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none" placeholder="Twoja wiadomość..."></textarea>
          </div>

          <button type="button" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow transition-colors">
            Wyślij wiadomość
          </button>
        </form>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 mt-12">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
          <h3 className="font-bold text-xl mb-2 text-[#E31837]">Zarząd VMPK</h3>
          <p className="text-slate-400">vmpk@vztm-kielce.pl</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-center">
          <h3 className="font-bold text-xl mb-2 text-[#005A9C]">Zarząd VBP</h3>
          <p className="text-slate-400">vbp@vztm-kielce.pl</p>
        </div>
      </div>
    </div>
  );
}
