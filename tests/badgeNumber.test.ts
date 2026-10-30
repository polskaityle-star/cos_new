import test from "node:test";
import assert from "node:assert/strict";
import { isValidBadgeNumber } from "../src/lib/roles.ts";

test("isValidBadgeNumber: akceptuje poprawne formaty numeru służbowego", () => {
  assert.equal(isValidBadgeNumber("K01"), true);
  assert.equal(isValidBadgeNumber("k01"), true);
  assert.equal(isValidBadgeNumber("W1"), true);
  assert.equal(isValidBadgeNumber("Z123"), true);
  assert.equal(isValidBadgeNumber("D9999"), true);
  assert.equal(isValidBadgeNumber("KP1234"), true); // 2 litery, 4 cyfry
  assert.equal(isValidBadgeNumber("ABC1234"), true); // 3 litery, 4 cyfry (długość 7 <= 8)
  assert.equal(isValidBadgeNumber("  K05  "), true); // trim
});

test("isValidBadgeNumber: odrzuca niepoprawne formaty numeru służbowego", () => {
  assert.equal(isValidBadgeNumber(""), false);
  assert.equal(isValidBadgeNumber("   "), false);
  assert.equal(isValidBadgeNumber(null), false);
  assert.equal(isValidBadgeNumber(undefined), false);

  // Za dużo liter (maks. 3)
  assert.equal(isValidBadgeNumber("ABCD12"), false);

  // Za dużo cyfr (maks. 4)
  assert.equal(isValidBadgeNumber("K12345"), false);

  // Brak cyfr
  assert.equal(isValidBadgeNumber("K"), false);
  assert.equal(isValidBadgeNumber("ZARZAD"), false);

  // Brak liter
  assert.equal(isValidBadgeNumber("123"), false);

  // Nieobsługiwane znaki specjalne
  assert.equal(isValidBadgeNumber("K-01"), false);
  assert.equal(isValidBadgeNumber("K_01"), false);
  assert.equal(isValidBadgeNumber("K 01"), false);
  assert.equal(isValidBadgeNumber("K.01"), false);

  // Długość powyżej 8 znaków
  assert.equal(isValidBadgeNumber("A".repeat(9)), false);
});
