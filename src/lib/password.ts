import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

const BCRYPT_RE = /^\$2[aby]\$/;

/**
 * Sprawdza hasło względem tego, co jest w bazie.
 * - hash bcrypt: zwykłe bcrypt.compare
 * - stare konto z hasłem jawnym tekstem: porównanie w stałym czasie,
 *   a po sukcesie (needsUpgrade) wołający powinien zapisać hash.
 * Żadnych haseł awaryjnych ani wyjątków dla kont zarządu.
 */
export async function verifyPassword(
  input: string,
  stored: string | null | undefined
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!stored) return { ok: false, needsUpgrade: false };

  if (BCRYPT_RE.test(stored)) {
    try {
      return { ok: await bcrypt.compare(input, stored), needsUpgrade: false };
    } catch {
      return { ok: false, needsUpgrade: false };
    }
  }

  const a = Buffer.from(input);
  const b = Buffer.from(stored);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  return { ok, needsUpgrade: ok };
}
