// Rejestruje komendy slash bota. Uruchom raz (i po każdej zmianie listy komend):
//   DISCORD_BOT_TOKEN=... DISCORD_APP_ID=... DISCORD_GUILD_ID=... node scripts/discord-register-commands.js
// Z DISCORD_GUILD_ID komendy pojawiają się od razu na serwerze; bez niego są globalne (do godziny zwłoki).
const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APP_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId) {
  console.error("Ustaw DISCORD_BOT_TOKEN oraz DISCORD_APP_ID (lub DISCORD_CLIENT_ID).");
  process.exit(1);
}

const commands = [
  { name: "panel", description: "Twój panel kierowcy - szybkie akcje, raporty, status", type: 1 },
  { name: "raport", description: "Złóż raport ze zrealizowanej służby (wybór i formularz)", type: 1 },
  { name: "usterka", description: "Zgłoś awarię lub usterkę pojazdu do warsztatu", type: 1 },
  { name: "wniosek", description: "Złóż wniosek kierowcy (urlop, dodatkowa służba, etat)", type: 1 },
  { name: "grafik", description: "Twój grafik służb na najbliższe 7 dni", type: 1 },
  { name: "sluzba", description: "Twoja służba na dziś i jutro", type: 1 },
  { name: "status", description: "Status Twojego konta w VZTM Kielce", type: 1 },
  { name: "linie", description: "Lista linii komunikacyjnych", type: 1 },
  { name: "tabor", description: "Stan taboru VMPK i VBP", type: 1 },
  { name: "zarzad", description: "Panel zarządu: liczniki i szybkie akcje", type: 1, default_member_permissions: "0", dm_permission: false },
];

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      console.error("Błąd", res.status, text);
      process.exit(1);
    }
    console.log("Zarejestrowano komendy:", JSON.parse(text).map((c) => "/" + c.name).join(", "));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
