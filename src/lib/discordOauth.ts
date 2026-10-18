import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const API = "https://discord.com/api/v10";

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("Brak NEXTAUTH_SECRET");
  return s;
}

function b64(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/** Podpisany, krótko ważny "state" wiążący proces OAuth z zalogowanym użytkownikiem. */
export function createLinkState(userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("hex");
  const payload = b64(JSON.stringify({ u: userId, n: nonce, e: Date.now() + 10 * 60 * 1000 }));
  const sig = b64(createHmac("sha256", secret()).update(payload).digest());
  return { state: `${payload}.${sig}`, nonce };
}

export function verifyLinkState(state: string): { userId: string; nonce: string } | null {
  try {
    const [payload, sig] = state.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.u !== "string" || typeof data.n !== "string" || typeof data.e !== "number") return null;
    if (data.e < Date.now()) return null;
    return { userId: data.u, nonce: data.n };
  } catch {
    return null;
  }
}

export interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
}

export async function exchangeCodeForProfile(code: string, redirectUri: string): Promise<DiscordProfile | null> {
  try {
    const tokenRes = await fetch(`${API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!tokenRes.ok) return null;
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return null;
    const meRes = await fetch(`${API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!meRes.ok) return null;
    const me = (await meRes.json()) as DiscordProfile;
    return me?.id ? me : null;
  } catch {
    return null;
  }
}
