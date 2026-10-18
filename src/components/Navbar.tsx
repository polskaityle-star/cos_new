"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import { canAccessManagementPanel, getRoleLabel, getRoleBadgeClass } from "@/lib/roles";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isVmpk = pathname.startsWith("/vmpk");
  const isVbp = pathname.startsWith("/vbp");
  const isCarrier = isVmpk || isVbp;

  let navClasses = "bg-white text-slate-900 border-b border-slate-200 shadow-xs";
  if (isVmpk) navClasses = "bg-[#E31837] text-white shadow-md carrier-nav";
  if (isVbp) navClasses = "bg-[#005A9C] text-white shadow-md carrier-nav";

  const hasManagementAccess = session?.user?.role ? canAccessManagementPanel(session.user.role) : false;

  return (
    <nav className={`${navClasses} transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <Link href="/" className="flex items-center group">
          <span
            className={`text-xl font-bold font-mono tracking-wider flex items-center gap-2 transition-colors ${
              isCarrier
                ? "text-white group-hover:text-amber-200"
                : "text-slate-900 group-hover:text-amber-600"
            }`}
          >
            🚍 VZTM KIELCE
          </span>
        </Link>
        <div className="flex gap-4 md:gap-5 items-center flex-wrap">
          <Link
            href="/"
            className={`font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-amber-200" : "text-slate-700 hover:text-amber-600"
            }`}
          >
            Strona główna
          </Link>
          <Link
            href="/vmpk"
            className={`font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-yellow-200" : "text-slate-700 hover:text-red-600"
            }`}
          >
            VMPK
          </Link>
          <Link
            href="/vbp"
            className={`font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-gray-200" : "text-slate-700 hover:text-blue-600"
            }`}
          >
            VBP
          </Link>
          <Link
            href="/kontakt"
            className={`font-semibold transition-colors ${
              isCarrier ? "text-white hover:opacity-80" : "text-slate-700 hover:text-amber-600"
            }`}
          >
            Kontakt
          </Link>
          
          <ThemeToggle />

          {session?.user ? (
            <div
              className={`flex items-center gap-3 py-1 px-3 rounded-lg border shadow-xs transition-colors ${
                isCarrier
                  ? "bg-black/30 border-white/20 text-white"
                  : "bg-slate-100 border-slate-300 text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {session.user.avatar ? (
                  <img
                    src={session.user.avatar}
                    alt={session.user.username}
                    className="w-7 h-7 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-xs"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCarrier
                        ? "bg-slate-800 border border-slate-600 text-amber-300"
                        : "bg-slate-200 border border-slate-300 text-slate-800"
                    }`}
                  >
                    {session.user.username?.slice(0, 2).toUpperCase() || "👤"}
                  </div>
                )}
                <span
                  className={`text-xs font-mono font-bold ${
                    isCarrier ? "text-white" : "text-slate-900"
                  }`}
                >
                  {session.user.username}
                  {session.user.badgeNumber && (
                    <span
                      className={`ml-1 text-[11px] font-bold ${
                        isCarrier ? "text-amber-300" : "text-amber-700"
                      }`}
                    >
                      [{session.user.badgeNumber}]
                    </span>
                  )}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    isCarrier
                      ? getRoleBadgeClass(session.user.role)
                      : "bg-white text-slate-800 border-slate-300 shadow-2xs"
                  }`}
                >
                  {getRoleLabel(session.user.role)}
                </span>
              </div>

              {hasManagementAccess && (
                <Link
                  href="/panel/zarzad"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors shadow"
                >
                  Panel zarządu
                </Link>
              )}

              <Link
                href="/panel/kierowca"
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
              >
                {session.user.avatar && (
                  <img
                    src={session.user.avatar}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover border border-amber-300 shrink-0"
                  />
                )}
                <span>Panel kierowcy</span>
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors shadow cursor-pointer"
                title="Wyloguj się"
              >
                Wyloguj
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-colors shadow"
              >
                Logowanie
              </Link>
              <Link
                href="/register"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-colors shadow"
              >
                Złóż wniosek
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
