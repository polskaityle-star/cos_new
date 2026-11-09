import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("discord commands match between scripts and route", () => {
  const scriptContent = fs.readFileSync("scripts/discord-register-commands.js", "utf-8");
  const routeContent = fs.readFileSync("src/app/api/panel/zarzad/discord-commands/route.ts", "utf-8");

  // Szukamy wyłącznie deklaracji `{ name: "...", description:`
  const regex = /\{\s*name:\s*"([^"]+)",\s*description:/g;

  const scriptCommands = new Set<string>();
  let match;
  while ((match = regex.exec(scriptContent)) !== null) {
    scriptCommands.add(match[1]);
  }

  const routeCommands = new Set<string>();
  while ((match = regex.exec(routeContent)) !== null) {
    routeCommands.add(match[1]);
  }

  assert.deepEqual(Array.from(scriptCommands).sort(), Array.from(routeCommands).sort());
});