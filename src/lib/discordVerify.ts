import { createPublicKey, verify } from "crypto";

// Prefiks DER (SPKI) dla klucza publicznego Ed25519 - Node wymaga pełnej struktury, a Discord podaje 32 surowe bajty.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Weryfikuje podpis żądania z Discorda (Interactions Endpoint). */
export function verifyDiscordRequest(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const pub = process.env.DISCORD_PUBLIC_KEY;
  if (!pub || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, Buffer.from(pub, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}
