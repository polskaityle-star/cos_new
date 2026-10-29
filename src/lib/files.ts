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
