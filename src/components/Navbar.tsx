"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  let navBg = "bg-slate-800";
  if (pathname.startsWith("/vmpk")) navBg = "bg-[#E31837] text-white"; // VMPK Red
  if (pathname.startsWith("/vbp")) navBg = "bg-[#005A9C] text-white"; // VBP Blue

  return (
    <nav className={`${navBg} shadow-md transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <Link href="/" className="flex flex-col group leading-tight">
          <span className="text-xl font-bold font-mono tracking-wider flex items-center gap-2 group-hover:text-amber-300 transition-colors">
            🚍 VZTM KIELCE
          </span>
          <span className="text-[11px] font-mono font-semibold text-amber-300/90 tracking-normal">
            v0.2.0.0
          </span>
        </Link>
        <div className="flex gap-4 md:gap-5 items-center flex-wrap">
          <Link href="/" className="hover:text-amber-300 font-semibold transition-colors">Strona Główna</Link>
          <Link href="/vmpk" className="hover:text-yellow-300 font-semibold transition-colors">VMPK</Link>
          <Link href="/vbp" className="hover:text-gray-300 font-semibold transition-colors">VBP</Link>
          <Link href="/linie" className="hover:opacity-80 transition-opacity">Linie</Link>
          <Link href="/brygady" className="hover:text-amber-300 font-semibold transition-colors">Brygady</Link>
          <Link href="/tabor" className="hover:opacity-80 transition-opacity">Tabor</Link>
          <Link href="/kontakt" className="hover:opacity-80 transition-opacity">Kontakt</Link>
          
          {session?.user ? (
            <div className="flex items-center gap-3 bg-slate-900/60 py-1 px-3 rounded-lg border border-slate-700/50">
              <span className="text-xs text-slate-300 font-mono">
                👤 {session.user.username}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${session.user.role === 'ZARZAD' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'}`}>
                  {session.user.role}
                </span>
              </span>

              {session.user.role === "ZARZAD" && (
                <Link href="/panel/zarzad" className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors">
                  Panel Zarządu
                </Link>
              )}

              <Link href="/panel/kierowca" className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors">
                Panel Kierowcy
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                title="Wyloguj się"
              >
                Wyloguj
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                Logowanie
              </Link>
              <Link href="/register" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                Złóż Wniosek
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
