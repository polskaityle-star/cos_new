import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPanelApi = pathname.startsWith("/api/panel");
  const isPanelPage = pathname.startsWith("/panel");

  // Sprawdzamy wyłącznie ścieżki panelu i API panelu
  if (!isPanelPage && !isPanelApi) {
    return NextResponse.next();
  }

  // Pobranie tokenu sesji NextAuth (JWT)
  // UWAGA: getToken odczytuje surowy token zapisany w ciasteczku (bez odpytywania bazy i bez uruchamiania callbacku jwt).
  // Jeśli rola użytkownika została zmieniona w bazie danych (np. awans KIEROWCA -> ZARZAD), token w przeglądarce
  // zawiera jeszcze poprzednią rolę do momentu wejścia na trasę wywołującą getServerSession / callback jwt (np. /panel/kierowca).
  // Dlatego poniższa blokada roli KIEROWCA w proxy stanowi wstępną warstwę zabezpieczeń (defense in depth),
  // a ostateczną i świeżą weryfikację uprawnień z bazy danych wykonują bezpośrednio app/panel/zarzad/page.tsx
  // oraz poszczególne handlery tras /api/panel/zarzad/* za pomocą getServerSession(authOptions).
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Brak sesji: 401 dla API, przekierowanie do /login dla stron panelu
  if (!token || !token.id) {
    if (isPanelApi) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = ((token.role as string) || "").toUpperCase();

  // Model uprawnień:
  // Rola KIEROWCA ma dostęp do /panel/kierowca oraz /api/panel/kierowca/*.
  // Próba wejścia do /panel/zarzad przekierowuje do /panel/kierowca, a do /api/panel/zarzad zwraca 403.
  if (role === "KIEROWCA") {
    if (pathname.startsWith("/panel/zarzad")) {
      return NextResponse.redirect(new URL("/panel/kierowca", req.url));
    }
    if (pathname.startsWith("/api/panel/zarzad")) {
      return NextResponse.json({ message: "Brak uprawnień do panelu zarządu" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ["/panel/:path*", "/api/panel/:path*"],
};
