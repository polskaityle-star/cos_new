import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("discord-commands: trasa zarzadu i skrypt rejestracji maja identyczny zbior komend", () => {
  const scriptPath = path.resolve(process.cwd(), "scripts/discord-register-commands.js");
  const routePath = path.resolve(process.cwd(), "src/app/api/panel/zarzad/discord-commands/route.ts");

  const scriptContent = fs.readFileSync(scriptPath, "utf8");
  const routeContent = fs.readFileSync(routePath, "utf8");

  const extractCommandNames = (content: string): Set<string> => {
    const regex = /name:\s*["']([^"']+)["']/g;
    const names = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      names.add(match[1]);
    }
    return names;
  };

  const scriptCommands = extractCommandNames(scriptContent);
  const routeCommands = extractCommandNames(routeContent);

  assert.ok(scriptCommands.size > 0, "Skrypt powinien definiować komendy");
  assert.ok(routeCommands.size > 0, "Trasa powinna definiować komendy");
  assert.ok(routeCommands.has("zarzad"), "Trasa musi zawierać komendę zarzad");
  assert.ok(scriptCommands.has("zarzad"), "Skrypt musi zawierać komendę zarzad");

  assert.deepEqual(
    Array.from(routeCommands).sort(),
    Array.from(scriptCommands).sort(),
    "Zbiory nazw komend w scripts/discord-register-commands.js i discord-commands/route.ts muszą być identyczne"
  );
});
