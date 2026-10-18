// Prosty limiter w pamięci (best effort: każda instancja serwera ma własny licznik).
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function prune(now: number) {
  if (store.size < 5000) return;
  for (const [k, b] of store) {
    if (b.resetAt <= now) store.delete(k);
  }
}

export function getClientIp(headers: Headers | Record<string, string | string[] | undefined> | null | undefined): string {
  let v: unknown;
  if (headers && typeof (headers as Headers).get === "function") {
    v = (headers as Headers).get("x-forwarded-for") ?? (headers as Headers).get("x-real-ip");
  } else if (headers && typeof headers === "object") {
    const record = headers as Record<string, string | string[] | undefined>;
    v = record["x-forwarded-for"] ?? record["x-real-ip"];
  }
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string" || !v) return "unknown";
  return v.split(",")[0].trim().slice(0, 64) || "unknown";
}

/** Zlicza próbę. Zwraca false, gdy limit został przekroczony. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export function isBlocked(key: string, max: number): boolean {
  const b = store.get(key);
  return !!b && b.resetAt > Date.now() && b.count >= max;
}

export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count += 1;
  }
}

export function clearKey(key: string): void {
  store.delete(key);
}
