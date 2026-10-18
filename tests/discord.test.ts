// Uruchomienie: node --experimental-strip-types --test tests/discord.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHmac } from "node:crypto";
import { createLinkState, verifyLinkState } from "../src/lib/discordOauth";
import { verifyDiscordRequest } from "../src/lib/discordVerify";

process.env.NEXTAUTH_SECRET = "test-secret-test-secret-test-secret";

test("OAuth state: poprawny round-trip", () => {
  const { state, nonce } = createLinkState("user-1");
  assert.deepEqual(verifyLinkState(state), { userId: "user-1", nonce });
});

test("OAuth state: sfałszowany payload", () => {
  const { state } = createLinkState("user-1");
  const [, sig] = state.split(".");
  const evil = Buffer.from(JSON.stringify({ u: "admin", n: "x", e: Date.now() + 1e6 })).toString("base64url");
  assert.equal(verifyLinkState(`${evil}.${sig}`), null);
});

test("OAuth state: zły podpis i śmieci", () => {
  const { state } = createLinkState("user-1");
  const [payload] = state.split(".");
  assert.equal(verifyLinkState(`${payload}.AAAA`), null);
  assert.equal(verifyLinkState("abc"), null);
  assert.equal(verifyLinkState(""), null);
});

test("OAuth state: wygasły token", () => {
  const payload = Buffer.from(JSON.stringify({ u: "u", n: "n", e: Date.now() - 1000 })).toString("base64url");
  const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(payload).digest().toString("base64url");
  assert.equal(verifyLinkState(`${payload}.${sig}`), null);
});

test("Ed25519: akceptuje poprawny podpis, odrzuca zły", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  process.env.DISCORD_PUBLIC_KEY = der.subarray(der.length - 32).toString("hex");
  const ts = "1700000000";
  const body = JSON.stringify({ type: 1 });
  const sig = sign(null, Buffer.from(ts + body), privateKey).toString("hex");
  assert.equal(verifyDiscordRequest(body, sig, ts), true);
  assert.equal(verifyDiscordRequest(body + " ", sig, ts), false);
  assert.equal(verifyDiscordRequest(body, sig, "1700000001"), false);
  assert.equal(verifyDiscordRequest(body, "00".repeat(64), ts), false);
  assert.equal(verifyDiscordRequest(body, null, ts), false);
  assert.equal(verifyDiscordRequest(body, sig, null), false);
});

test("Ed25519: brak klucza publicznego odrzuca żądanie", () => {
  delete process.env.DISCORD_PUBLIC_KEY;
  assert.equal(verifyDiscordRequest("{}", "00".repeat(64), "1"), false);
});
