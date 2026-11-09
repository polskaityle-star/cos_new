import test from "node:test";
import assert from "node:assert";
import { assertSameOrigin } from "../src/lib/csrf.ts";

test("assertSameOrigin: zgodny Origin \u2192 null", () => {
  const req = new Request("https://panel.vztm.pl/api/test", {
    method: "POST",
    headers: {
      origin: "https://panel.vztm.pl",
      host: "panel.vztm.pl",
    },
  });

  const result = assertSameOrigin(req);
  assert.strictEqual(result, null);
});

test("assertSameOrigin: obcy Origin \u2192 403", () => {
  const req = new Request("https://panel.vztm.pl/api/test", {
    method: "POST",
    headers: {
      origin: "https://evil.com",
      host: "panel.vztm.pl",
    },
  });

  const result = assertSameOrigin(req);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.status, 403);
});

test("assertSameOrigin: brak Origin i Referer \u2192 403", () => {
  const req = new Request("https://panel.vztm.pl/api/test", {
    method: "POST",
    headers: {
      host: "panel.vztm.pl",
    },
  });

  const result = assertSameOrigin(req);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.status, 403);
});

test("assertSameOrigin: użycie x-forwarded-host", () => {
  const req = new Request("https://panel.vztm.pl/api/test", {
    method: "POST",
    headers: {
      origin: "https://panel.vztm.pl",
      "x-forwarded-host": "panel.vztm.pl",
    },
  });

  const result = assertSameOrigin(req);
  assert.strictEqual(result, null);
});

test("assertSameOrigin: Referer jako fallback", () => {
  const req = new Request("https://panel.vztm.pl/api/test", {
    method: "POST",
    headers: {
      referer: "https://panel.vztm.pl/strona",
      host: "panel.vztm.pl",
    },
  });

  const result = assertSameOrigin(req);
  assert.strictEqual(result, null);
});
