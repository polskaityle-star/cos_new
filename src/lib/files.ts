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
 * Waliduje czy URL obrazu jest na liście zaufanych hostów bez hasła, loginu, nawiasów i spacji.
 */
export function isTrustedImageHost(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes(" ") || trimmed.includes("(") || trimmed.includes(")")) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;

    const allowedHosts = [
      "cdn.discordapp.com",
      "media.discordapp.net",
      "i.imgur.com",
      "prnt.sc",
      "zapodaj.net"
    ];
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
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

/**
 * Rozpoznaje typ przesłanego pliku na podstawie jego pierwszych bajtów ("magic bytes").
 * Wspiera PNG, JPEG, WebP oraz pliki tekstowe.
 */
export function detectUploadKind(buffer: Buffer): "png" | "jpeg" | "webp" | "text" | null {
  if (buffer.length === 0) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // WebP: RIFF ... WEBP
  if (buffer.length >= 12) {
    const riff = buffer.toString("ascii", 0, 4);
    const webp = buffer.toString("ascii", 8, 12);
    if (riff === "RIFF" && webp === "WEBP") {
      return "webp";
    }
  }

  // text: brak bajtów NUL (0x00) w pierwszych 8 KB oraz poprawny UTF-8
  const checkLen = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0x00) {
      return null;
    }
  }

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buffer);
    return "text";
  } catch {
    return null;
  }
}
