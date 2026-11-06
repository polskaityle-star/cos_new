import test from "node:test";
import assert from "node:assert/strict";
import { isValidBadgeNumber } from "../src/lib/roles";

test("isValidBadgeNumber validates correctly", () => {
  assert.equal(isValidBadgeNumber("K123"), true);
  assert.equal(isValidBadgeNumber("W0"), true);
  assert.equal(isValidBadgeNumber("ABC1234"), true);
  assert.equal(isValidBadgeNumber(" aB12  "), true); // Spacje przed i po są poprawne według trim()
  assert.equal(isValidBadgeNumber("K12345"), false); // 5 cyfr
  assert.equal(isValidBadgeNumber("ABCD12"), false); // 4 litery
  assert.equal(isValidBadgeNumber("K-123"), false);
  assert.equal(isValidBadgeNumber("123K"), false);
  assert.equal(isValidBadgeNumber("A1234567"), false); // Ponad 8 znaków po trim
});