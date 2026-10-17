import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt – VZTM Kielce",
  description: "Skontaktuj się z Zarządem VZTM Kielce oraz przewoźnikami VMPK i VBP Tour Regio. Formularz kontaktowy i bezpośrednie adresy e-mail.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
