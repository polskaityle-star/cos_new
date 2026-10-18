import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import packageInfo from "../../package.json";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VZTM Kielce – Wirtualny Zarząd Transportu Miejskiego",
  description: "Wirtualny Zarząd Transportu Miejskiego w Kielcach dla gry OMSI 2.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('vztm_theme');
                if (t === 'light') {
                  document.documentElement.classList.add('light');
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.classList.remove('light');
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-900 text-slate-100`}>
        <Providers>
          <Navbar />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="bg-slate-800 py-6 text-center text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} VZTM Kielce (OMSI 2 Wirtualna Firma) • wersja {packageInfo.version}</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
