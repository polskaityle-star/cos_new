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

  // Token może zawierać starą rolę. Uprawnienia do panelu zarządu
  // sprawdzają strony i endpointy po odświeżeniu sesji z bazy.

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ["/panel/:path*", "/api/panel/:path*"],
};
