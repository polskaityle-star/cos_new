import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Złóż wniosek – VZTM Kielce",
  description: "Złóż wniosek rekrutacyjny do wirtualnej firmy VZTM Kielce dla gry OMSI 2. Wybierz przewoźnika VMPK lub VBP i rozpocznij karierę kierowcy.",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
