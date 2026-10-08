"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import { canAccessManagementPanel, getRoleLabel, getRoleBadgeClass } from "@/lib/roles";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  let navBg = "bg-slate-800";
  if (pathname.startsWith("/vmpk")) navBg = "bg-[#E31837] text-white"; // VMPK Red
  if (pathname.startsWith("/vbp")) navBg = "bg-[#005A9C] text-white"; // VBP Blue

  const hasManagementAccess = session?.user?.role ? canAccessManagementPanel(session.user.role) : false;

  return (
    <nav className={`${navBg} shadow-md transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <Link href="/" className="flex flex-col group leading-tight">
          <span className="text-xl font-bold font-mono tracking-wider flex items-center gap-2 group-hover:text-amber-300 transition-colors">
            🚍 VZTM KIELCE
          </span>
          <span className="text-[11px] font-mono font-semibold text-amber-300/90 tracking-normal">
            v0.3.0.0
          </span>
        </Link>
        <div className="flex gap-4 md:gap-5 items-center flex-wrap">
          <Link href="/" className="hover:text-amber-300 font-semibold transition-colors">Strona Główna</Link>
          <Link href="/vmpk" className="hover:text-yellow-300 font-semibold transition-colors">VMPK</Link>
          <Link href="/vbp" className="hover:text-gray-300 font-semibold transition-colors">VBP</Link>
          <Link href="/kontakt" className="hover:opacity-80 transition-opacity">Kontakt</Link>
          
          <ThemeToggle />

          {session?.user ? (
            <div className="flex items-center gap-3 bg-slate-900/60 py-1 px-3 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-2">
                {session.user.avatar ? (
                  <img
                    src={session.user.avatar}
                    alt={session.user.username}
                    className="w-6 h-6 rounded-full object-cover border border-amber-400"
                  />
                ) : (
                  <span className="text-xs">👤</span>
                )}
                <span className="text-xs text-slate-300 font-mono font-bold">
                  {session.user.username}
                  {session.user.badgeNumber && (
                    <span className="ml-1 text-[11px] text-amber-300 font-semibold">
                      [{session.user.badgeNumber}]
                    </span>
                  )}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeClass(session.user.role)}`}>
                  {getRoleLabel(session.user.role)}
                </span>
              </div>

              {hasManagementAccess && (
                <Link href="/panel/zarzad" className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors shadow">
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
