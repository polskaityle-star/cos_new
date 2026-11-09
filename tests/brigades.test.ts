import test from "node:test";
import assert from "node:assert/strict";
import { isBrigadeAllowedOnWeekday } from "../src/lib/brigades.ts";

test("isBrigadeAllowedOnWeekday: order 1 w sobotę → false", () => {
  assert.equal(isBrigadeAllowedOnWeekday(1, 6), false);
});

test("isBrigadeAllowedOnWeekday: order 2 w sobotę → true", () => {
  assert.equal(isBrigadeAllowedOnWeekday(2, 6), true);
});

test("isBrigadeAllowedOnWeekday: order 3 w poniedziałek → true", () => {
  assert.equal(isBrigadeAllowedOnWeekday(3, 1), true);
});
