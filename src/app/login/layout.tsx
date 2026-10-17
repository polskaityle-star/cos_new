import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logowanie – VZTM Kielce",
  description: "Zaloguj się do panelu pracowniczego VZTM Kielce. Dostęp do grafiku służb, rozkładów jazdy, taboru oraz raportów dla kierowców OMSI 2.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
