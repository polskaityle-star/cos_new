"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  let navBg = "bg-slate-800";
  if (pathname.startsWith("/vmpk")) navBg = "bg-[#E31837] text-white"; // VMPK Red
  if (pathname.startsWith("/vbp")) navBg = "bg-[#005A9C] text-white"; // VBP Blue

  return (
    <nav className={`${navBg} shadow-md transition-colors duration-300`}>
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold font-mono tracking-wider">
          VZTM KIELCE
        </Link>
        <div className="flex gap-6 items-center">
          <Link href="/vmpk" className="hover:text-yellow-300 font-semibold transition-colors">VMPK</Link>
          <Link href="/vbp" className="hover:text-gray-300 font-semibold transition-colors">VBP</Link>
          <Link href="/linie" className="hover:opacity-80 transition-opacity">Linie</Link>
          <Link href="/tabor" className="hover:opacity-80 transition-opacity">Tabor</Link>
          <Link href="/kontakt" className="hover:opacity-80 transition-opacity">Kontakt</Link>
          <Link href="/login" className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md transition-colors">
            Panel Kierowcy
          </Link>
        </div>
      </div>
    </nav>
  );
}
