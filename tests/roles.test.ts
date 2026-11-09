import test from "node:test";
import assert from "node:assert/strict";
import { isValidBadgeNumber } from "../src/lib/roles.ts";
import { warsawTodayStr, dutyDateStr } from "../src/lib/dates.ts";

test("date helpers use Warsaw today and preserve stored duty date", () => {
  assert.equal(warsawTodayStr(new Date("2026-11-08T23:30:00Z")), "2026-11-09");
  assert.equal(warsawTodayStr(new Date("2026-07-10T22:30:00Z")), "2026-07-11");
  assert.equal(dutyDateStr(new Date("2026-11-09T00:00:00Z")), "2026-11-09");
});

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
