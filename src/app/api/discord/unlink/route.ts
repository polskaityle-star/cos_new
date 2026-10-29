import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchGuildRoles } from "@/lib/discord";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordId: true },
  });

  if (user?.discordId) {
    try {
      const guildId = process.env.DISCORD_GUILD_ID?.trim();
      const token = process.env.DISCORD_BOT_TOKEN?.trim();

      if (guildId && token) {
        // 1. Zdejmij pseudonim na serwerze Discord (ustaw na null)
        try {
          await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user.discordId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bot ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ nick: null }),
          });
        } catch (e) {
          console.error("[discord/unlink] Błąd resetu pseudonimu:", e);
        }

        // 2. Zdejmij zarządzane role na serwerze Discord
        try {
          const guildRoles = await fetchGuildRoles();
          const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user.discordId}`, {
            headers: { Authorization: `Bot ${token}` },
          });

          if (memberRes.ok) {
            const member = (await memberRes.json()) as { roles?: string[] };
            const memberRoles = new Set(member.roles || []);

            const managedNames = [
              "właściciel", "wlasciciel", "zarząd", "zarzad", "head admin", "owner", "zarządca",
              "dyspozytor", "dyspozytornia", "dyspozytorzy",
              "kierownik przewozów", "kierownik przewozow", "kierownik działu przewozów", "kierownik dzialu przewozow", "kierownik",
              "mechanik", "serwis", "warsztat",
              "sprawdzający", "sprawdzajacy", "weryfikator",
              "kierowca", "kierowcy", "driver",
              "vmpk", "vmpk kielce",
              "vbp", "vbp tour regio", "vbp kielce",
            ];
            const envRoleKeys = [
              "DISCORD_ROLE_WLASCICIEL", "DISCORD_ROLE_DYSPOZYTOR", "DISCORD_ROLE_KIEROWNIK",
              "DISCORD_ROLE_MECHANIK", "DISCORD_ROLE_SPRAWDZAJACY", "DISCORD_ROLE_KIEROWCA",
              "DISCORD_ROLE_VMPK", "DISCORD_ROLE_VBP",
            ];

            const managedIds = new Set<string>();
            for (const envKey of envRoleKeys) {
              const val = process.env[envKey]?.trim();
              if (val) {
                if (/^\d{15,25}$/.test(val)) managedIds.add(val);
                const r = guildRoles.find((gr) => gr.id === val || gr.name.toLowerCase() === val.toLowerCase());
                if (r) managedIds.add(r.id);
              }
            }
            for (const gr of guildRoles) {
              if (managedNames.includes(gr.name.toLowerCase())) {
                managedIds.add(gr.id);
              }
            }

            for (const roleId of managedIds) {
              if (memberRoles.has(roleId)) {
                await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${user.discordId}/roles/${roleId}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bot ${token}` },
                });
              }
            }
          }
        } catch (e) {
          console.error("[discord/unlink] Błąd zdejmowania ról:", e);
        }
      }
    } catch (err) {
      console.error("[discord/unlink] Błąd podczas komunikacji z Discord API:", err);
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { discordId: null, discordUsername: null },
  });

  return NextResponse.json({ success: true });
}
