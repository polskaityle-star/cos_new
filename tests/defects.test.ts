import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDefectTransition,
  isAllowedDefectTransition,
} from "../src/lib/defects.ts";

test("validateDefectTransition: dozwolone przejścia ze statusu NOWE", () => {
  // NOWE -> WARSZTAT (dozwolone)
  const toWorkshop = validateDefectTransition("NOWE", "WARSZTAT");
  assert.equal(toWorkshop.valid, true);
  assert.equal(toWorkshop.status, 200);
  assert.equal(isAllowedDefectTransition("NOWE", "WARSZTAT"), true);

  // NOWE -> ODRZUCONE (dozwolone)
  const toRejected = validateDefectTransition("NOWE", "ODRZUCONE");
  assert.equal(toRejected.valid, true);
  assert.equal(toRejected.status, 200);
  assert.equal(isAllowedDefectTransition("NOWE", "ODRZUCONE"), true);
});

test("validateDefectTransition: niedozwolone przejścia ze statusu NOWE", () => {
  // NOWE -> NAPRAWIONE (niedozwolone, musi przejść przez warsztat)
  const toFixed = validateDefectTransition("NOWE", "NAPRAWIONE");
  assert.equal(toFixed.valid, false);
  assert.equal(toFixed.status, 400);
  assert.equal(toFixed.message, "niedozwolona zmiana statusu usterki");
  assert.equal(isAllowedDefectTransition("NOWE", "NAPRAWIONE"), false);

  // NOWE -> NOWE (ten sam status -> 409)
  const same = validateDefectTransition("NOWE", "NOWE");
  assert.equal(same.valid, false);
  assert.equal(same.status, 409);
  assert.equal(same.message, "usterka ma już ten status");
  assert.equal(isAllowedDefectTransition("NOWE", "NOWE"), false);
});

test("validateDefectTransition: dozwolone przejścia ze statusu WARSZTAT", () => {
  // WARSZTAT -> NAPRAWIONE (dozwolone)
  const toFixed = validateDefectTransition("WARSZTAT", "NAPRAWIONE");
  assert.equal(toFixed.valid, true);
  assert.equal(toFixed.status, 200);
  assert.equal(isAllowedDefectTransition("WARSZTAT", "NAPRAWIONE"), true);

  // WARSZTAT -> ODRZUCONE (dozwolone)
  const toRejected = validateDefectTransition("WARSZTAT", "ODRZUCONE");
  assert.equal(toRejected.valid, true);
  assert.equal(toRejected.status, 200);
  assert.equal(isAllowedDefectTransition("WARSZTAT", "ODRZUCONE"), true);
});

test("validateDefectTransition: niedozwolone przejścia ze statusu WARSZTAT", () => {
  // WARSZTAT -> NOWE (niedozwolone)
  const toNew = validateDefectTransition("WARSZTAT", "NOWE");
  assert.equal(toNew.valid, false);
  assert.equal(toNew.status, 400);
  assert.equal(toNew.message, "niedozwolona zmiana statusu usterki");
  assert.equal(isAllowedDefectTransition("WARSZTAT", "NOWE"), false);

  // WARSZTAT -> WARSZTAT (ten sam status -> 409)
  const same = validateDefectTransition("WARSZTAT", "WARSZTAT");
  assert.equal(same.valid, false);
  assert.equal(same.status, 409);
  assert.equal(same.message, "usterka ma już ten status");
});

test("validateDefectTransition: brak możliwości zmiany statusu ze statusu NAPRAWIONE", () => {
  assert.equal(validateDefectTransition("NAPRAWIONE", "NAPRAWIONE").status, 409);
  assert.equal(validateDefectTransition("NAPRAWIONE", "NOWE").status, 400);
  assert.equal(validateDefectTransition("NAPRAWIONE", "WARSZTAT").status, 400);
  assert.equal(validateDefectTransition("NAPRAWIONE", "ODRZUCONE").status, 400);

  assert.equal(isAllowedDefectTransition("NAPRAWIONE", "WARSZTAT"), false);
  assert.equal(isAllowedDefectTransition("NAPRAWIONE", "NOWE"), false);
});

test("validateDefectTransition: brak możliwości zmiany statusu ze statusu ODRZUCONE", () => {
  assert.equal(validateDefectTransition("ODRZUCONE", "ODRZUCONE").status, 409);
  assert.equal(validateDefectTransition("ODRZUCONE", "NOWE").status, 400);
  assert.equal(validateDefectTransition("ODRZUCONE", "WARSZTAT").status, 400);
  assert.equal(validateDefectTransition("ODRZUCONE", "NAPRAWIONE").status, 400);

  assert.equal(isAllowedDefectTransition("ODRZUCONE", "WARSZTAT"), false);
  assert.equal(isAllowedDefectTransition("ODRZUCONE", "NAPRAWIONE"), false);
});

test("validateDefectTransition: nieznane statusy zwracają 400", () => {
  assert.equal(validateDefectTransition("UNKNOWN", "WARSZTAT").status, 400);
  assert.equal(validateDefectTransition("NOWE", "INNY").status, 400);
});
