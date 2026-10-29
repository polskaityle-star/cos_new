/**
 * Porównuje host z nagłówka Origin (lub Referer, gdy brak Origin) z nagłówkiem Host.
 * Przy niezgodności zwraca Response 403, w przeciwnym razie null.
 */
export function assertSameOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const candidate = origin || referer;

  if (!candidate) {
    return new Response(JSON.stringify({ message: "Brak nagłówka Origin/Referer" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = new URL(candidate);
    const originHost = parsed.host.toLowerCase();

    const forwardedHost = req.headers.get("x-forwarded-host");
    const rawHost = forwardedHost ? forwardedHost.split(",")[0].trim() : req.headers.get("host");
    const hostHeader = (rawHost || "").toLowerCase();

    if (!hostHeader || originHost !== hostHeader) {
      return new Response(JSON.stringify({ message: "CSRF check failed: niedozwolone źródło żądania" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ message: "Nieprawidłowy nagłówek Origin/Referer" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
