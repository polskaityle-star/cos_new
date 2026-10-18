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

  let navClasses = "main-nav bg-white dark:bg-black text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 shadow-xs";
  if (isVmpk) navClasses = "carrier-nav bg-[#E31837] text-white shadow-md";
  if (isVbp) navClasses = "carrier-nav bg-[#005A9C] text-white shadow-md";

  const hasManagementAccess = session?.user?.role ? canAccessManagementPanel(session.user.role) : false;

  return (
    <nav className={`${navClasses} transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <Link href="/" className="flex items-center group">
          <span
            className={`nav-logo text-xl font-bold font-mono tracking-wider flex items-center gap-2 transition-colors ${
              isCarrier
                ? "text-white group-hover:text-amber-200"
                : "text-slate-900 dark:text-white group-hover:text-amber-500"
            }`}
          >
            🚍 VZTM KIELCE
          </span>
        </Link>
        <div className="flex gap-4 md:gap-5 items-center flex-wrap">
          <Link
            href="/"
            className={`nav-link font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-amber-200" : "text-slate-700 dark:text-slate-200 hover:text-amber-500"
            }`}
          >
            Strona główna
          </Link>
          <Link
            href="/vmpk"
            className={`nav-link font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-yellow-200" : "text-slate-700 dark:text-slate-200 hover:text-red-500"
            }`}
          >
            VMPK
          </Link>
          <Link
            href="/vbp"
            className={`nav-link font-semibold transition-colors ${
              isCarrier ? "text-white hover:text-gray-200" : "text-slate-700 dark:text-slate-200 hover:text-blue-500"
            }`}
          >
            VBP
          </Link>
          <Link
            href="/kontakt"
            className={`nav-link font-semibold transition-colors ${
              isCarrier ? "text-white hover:opacity-80" : "text-slate-700 dark:text-slate-200 hover:text-amber-500"
            }`}
          >
            Kontakt
          </Link>
          
          <ThemeToggle />

          {session?.user ? (
            <div
              className={`nav-user-capsule flex items-center gap-3 py-1 px-3 rounded-lg border shadow-xs transition-colors ${
                isCarrier
                  ? "bg-black/30 border-white/20 text-white"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
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
                  className={`nav-username text-xs font-mono font-bold flex items-center gap-1.5 ${
                    isCarrier ? "text-white" : "text-slate-900 dark:text-white"
                  }`}
                >
                  {(session.user.badgeNumber || (session.user.username?.toLowerCase() === "godksawiss" ? "W1" : null)) && (
                    <span
                      className={`nav-badge-number px-1.5 py-0.5 rounded text-[11px] font-extrabold shadow-2xs ${
                        isCarrier
                          ? "bg-white/20 text-amber-300 border border-white/30"
                          : "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700"
                      }`}
                    >
                      {session.user.badgeNumber || (session.user.username?.toLowerCase() === "godksawiss" ? "W1" : null)}
                    </span>
                  )}
                  <span>{session.user.username}</span>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                    isCarrier
                      ? getRoleBadgeClass(session.user.role)
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 shadow-2xs"
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
                className="nav-btn-driver px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
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
                className="nav-btn-login px-3 py-1.5 rounded-md text-sm font-semibold transition-colors shadow-xs"
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
