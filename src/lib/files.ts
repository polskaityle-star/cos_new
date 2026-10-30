/**
 * Bezpieczna walidacja plików raportów i załączników.
 * Zapobiega atakom path traversal (np. /uploads/reports/../../.env) oraz XSS (np. data:image/svg+xml, javascript:).
 */
export function isSafeStoredFile(value: string | null | undefined, kind: "image" | "text" = "image"): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  // 1. data URI
  if (kind === "image") {
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return true;
    }
  } else if (kind === "text") {
    if (/^data:text\/plain(;[a-zA-Z0-9=_-]+)*;base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return true;
    }
    // Obsługa zwykłego tekstu lub data:text/plain bez base64
    if (/^data:text\/plain/i.test(trimmed)) {
      return true;
    }
  }

  // 2. Bezpieczna relatywna ścieżka na serwerze
  if (trimmed.startsWith("/uploads/reports/")) {
    const filename = trimmed.slice("/uploads/reports/".length);
    // Nazwa musi składać się wyłącznie z bezpiecznych znaków i nie zawierać .. ani separatorów
    if (
      filename.length > 0 &&
      !filename.includes("..") &&
      !filename.includes("/") &&
      !filename.includes("\\") &&
      /^[A-Za-z0-9._-]+$/.test(filename)
    ) {
      return true;
    }
    return false;
  }

  // 3. URL HTTPS
  if (trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Waliduje czy URL obrazu jest bezpieczny do wyrenderowania w tagach <img src> lub <a href>.
 * Dozwolone: data:image/(png|jpeg|webp);base64,..., ścieżki zaczynające się od /uploads/ oraz URL https://.
 */
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) return true;
  if (trimmed.startsWith("/uploads/") && !trimmed.includes("..")) return true;
  if (trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

export const TRUSTED_IMAGE_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];

/**
 * Sprawdza, czy URL jest bezpiecznym linkiem zewnętrznym do wyświetlenia w embedzie bota Discord.
 * Wymogi:
 * - protokół https:
 * - brak spacji i nawiasów okrągłych (zapobiega uszkodzeniu markdownu w Discordzie)
 * - hostname należy do allowlisty (cdn.discordapp.com, media.discordapp.net)
 */
export function isTrustedImageHost(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return false;
  if (/[\s()]/.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return TRUSTED_IMAGE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Formatuje zrzut ekranu do embeda bota Discord:
 * - Jeśli URL należy do zaufanych hostów i jest poprawny -> link z etykietą zawierającą hostname: [Etykieta (hostname)](url)
 * - W przeciwnym razie -> tekst informacyjny, że link jest niedostępny w bocie (sprawdź w panelu WWW).
 */
export function formatScreenshotForDiscord(
  rawUrl: string | null | undefined,
  label: string
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (isTrustedImageHost(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `[${label} (${parsed.hostname})](${trimmed})`;
    } catch {
      // fallback
    }
  }

  return `${label}: link niedostępny w bocie, sprawdź w panelu WWW`;
}
