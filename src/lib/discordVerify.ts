import { createPublicKey, verify } from "crypto";

// Prefiks DER (SPKI) dla klucza publicznego Ed25519 - Node wymaga pełnej struktury, a Discord podaje 32 surowe bajty.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Weryfikuje podpis żądania z Discorda (Interactions Endpoint). */
export function verifyDiscordRequest(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const pub = process.env.DISCORD_PUBLIC_KEY?.trim();
  const sig = signature?.trim();
  const ts = timestamp?.trim();

  if (!pub) {
    console.error("[discordVerify] BRAK zmiennej środowiskowej DISCORD_PUBLIC_KEY na Vercelu! Discord odrzuci weryfikację endpointu (401).");
    return false;
  }

  if (!sig || !ts) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(ts + rawBody), key, Buffer.from(sig, "hex"));
  } catch (err) {
    console.error("[discordVerify] Błąd weryfikacji podpisu Ed25519:", (err as Error)?.message);
    return false;
  }
}
