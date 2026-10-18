// Awaryjne ustawienie hasła właściciela (uruchamiane LOKALNIE, nie na serwerze).
// W folderze projektu, z poprawnym DATABASE_URL w pliku .env:
//   Windows PowerShell:
//     $env:OWNER_PASSWORD="twoje-nowe-silne-haslo"; node prisma/reset-owner-password.js
// Opcjonalnie: $env:OWNER_USERNAME="Godksawiss" (to jest wartość domyślna)
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const username = process.env.OWNER_USERNAME || "Godksawiss";
  const password = process.env.OWNER_PASSWORD;
  if (!password || password.length < 8) {
    console.error("Ustaw OWNER_PASSWORD (min. 8 znaków).");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hash, role: "WLASCICIEL", status: "ACCEPTED" },
    });
    console.log(`Zaktualizowano konto ${username} (rola WLASCICIEL, status ACCEPTED).`);
  } else {
    await prisma.user.create({
      data: { username, password: hash, role: "WLASCICIEL", status: "ACCEPTED", badgeNumber: "W1", carrier: "VMPK" },
    });
    console.log(`Utworzono konto ${username}.`);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
