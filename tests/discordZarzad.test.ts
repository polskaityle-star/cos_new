import test from "node:test";
import assert from "node:assert/strict";
import {
  parseZarzadCustomId,
  getZarzadPermissions,
  ID_REGEX,
} from "../src/lib/discordZarzad.ts";

test("ID_REGEX waliduje cuid i uuid", () => {
  assert.equal(ID_REGEX.test("clh1234567890abcdef"), true);
  assert.equal(ID_REGEX.test("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(ID_REGEX.test(""), false);
  assert.equal(ID_REGEX.test("id/with/slash"), false);
  assert.equal(ID_REGEX.test("id with space"), false);
  assert.equal(ID_REGEX.test("a".repeat(65)), false);
});

test("parseZarzadCustomId: poprawne rozpoznawanie akcji menu i list", () => {
  assert.deepEqual(parseZarzadCustomId("zarzad_menu"), { action: "menu" });
  assert.deepEqual(parseZarzadCustomId("zarzad_main"), { action: "menu" });
  assert.deepEqual(parseZarzadCustomId("zarzad_req_list:0"), { action: "req_list", offset: 0 });
  assert.deepEqual(parseZarzadCustomId("zarzad_req_list:2"), { action: "req_list", offset: 2 });
  assert.deepEqual(parseZarzadCustomId("zarzad_rep_list:1"), { action: "rep_list", offset: 1 });
  assert.deepEqual(parseZarzadCustomId("zarzad_def_list:0"), { action: "def_list", offset: 0 });
  assert.deepEqual(parseZarzadCustomId("zarzad_cand_list:3"), { action: "cand_list", offset: 3 });
});

test("parseZarzadCustomId: akcje na obiektach z walidacją ID", () => {
  assert.deepEqual(parseZarzadCustomId("zarzad_req_approve:clh123"), {
    action: "req_approve",
    targetId: "clh123",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_req_reject:clh123"), {
    action: "req_reject",
    targetId: "clh123",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_rep_approve:rep_abc-123"), {
    action: "rep_approve",
    targetId: "rep_abc-123",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_rep_reject:rep_abc-123"), {
    action: "rep_reject",
    targetId: "rep_abc-123",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_def_repair:def_456"), {
    action: "def_repair",
    targetId: "def_456",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_def_fixed:def_456"), {
    action: "def_fixed",
    targetId: "def_456",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_def_reject:def_456"), {
    action: "def_reject",
    targetId: "def_456",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_cand_approve:usr_789"), {
    action: "cand_approve",
    targetId: "usr_789",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_cand_approve_vmpk:usr_789"), {
    action: "cand_approve_vmpk",
    targetId: "usr_789",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_cand_approve_vbp:usr_789"), {
    action: "cand_approve_vbp",
    targetId: "usr_789",
  });
  assert.deepEqual(parseZarzadCustomId("zarzad_cand_reject:usr_789"), {
    action: "cand_reject",
    targetId: "usr_789",
  });
});

test("parseZarzadCustomId: odrzuca nieznane lub sfałszowane identyfikatory", () => {
  assert.equal(parseZarzadCustomId("other_action"), null);
  assert.equal(parseZarzadCustomId("zarzad_unknown:123"), null);
  assert.equal(parseZarzadCustomId("zarzad_req_approve:bad/id"), null);
  assert.equal(parseZarzadCustomId("zarzad_def_repair:bad id"), null);
  assert.equal(parseZarzadCustomId("zarzad_req_list:-1"), null);
  assert.equal(parseZarzadCustomId("zarzad_req_list:abc"), null);
});

test("getZarzadPermissions: poprawne mapowanie ról", () => {
  const owner = getZarzadPermissions("WLASCICIEL");
  assert.equal(owner.canAccess, true);
  assert.equal(owner.canRequests, true);
  assert.equal(owner.canReports, true);
  assert.equal(owner.canFleet, true);
  assert.equal(owner.canUsers, true);

  const zarzad = getZarzadPermissions("ZARZAD");
  assert.equal(zarzad.canAccess, true);
  assert.equal(zarzad.canRequests, true);
  assert.equal(zarzad.canReports, true);
  assert.equal(zarzad.canFleet, true);
  assert.equal(zarzad.canUsers, true);

  const sprawdzajacy = getZarzadPermissions("SPRAWDZAJACY");
  assert.equal(sprawdzajacy.canAccess, true);
  assert.equal(sprawdzajacy.canRequests, true);
  assert.equal(sprawdzajacy.canReports, true);
  assert.equal(sprawdzajacy.canFleet, false);
  assert.equal(sprawdzajacy.canUsers, false);

  const dyspozytor = getZarzadPermissions("DYSPOZYTOR");
  assert.equal(dyspozytor.canAccess, true);
  assert.equal(dyspozytor.canRequests, false);
  assert.equal(dyspozytor.canReports, false);
  assert.equal(dyspozytor.canFleet, false);
  assert.equal(dyspozytor.canUsers, false);

  const mechanik = getZarzadPermissions("MECHANIK");
  assert.equal(mechanik.canAccess, true);
  assert.equal(mechanik.canRequests, false);
  assert.equal(mechanik.canReports, false);
  assert.equal(mechanik.canFleet, true);
  assert.equal(mechanik.canUsers, false);

  const kierowca = getZarzadPermissions("KIEROWCA");
  assert.equal(kierowca.canAccess, false);
  assert.equal(kierowca.canRequests, false);
  assert.equal(kierowca.canFleet, false);
  assert.equal(kierowca.canUsers, false);
});
