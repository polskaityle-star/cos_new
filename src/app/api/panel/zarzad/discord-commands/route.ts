import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);
  if (!session?.user || !canManageUsers(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const appId = (process.env.DISCORD_APP_ID || process.env.DISCORD_CLIENT_ID)?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  if (!token) {
    return NextResponse.json(
      {
        message: "Brak zmiennej środowiskowej DISCORD_BOT_TOKEN w konfiguracji Vercel/.env. Ustaw token bota.",
      },
      { status: 400 }
    );
  }

  if (!appId) {
    return NextResponse.json(
      {
        message: "Brak zmiennej DISCORD_APP_ID lub DISCORD_CLIENT_ID w konfiguracji Vercel/.env.",
      },
      { status: 400 }
    );
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
  ];

  const targetUrl = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  try {
    const res = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error("[discord-commands] Discord API error:", res.status, responseText);
      return NextResponse.json(
        {
          message: "Wystąpił błąd podczas rejestracji komend w API Discorda.",
        },
        { status: 400 }
      );
    }

    interface RegisteredCommand {
      id?: string;
      name?: string;
    }
    const registered: RegisteredCommand[] = JSON.parse(responseText);
    const commandNames = registered.map((c) => `/${c.name}`).join(", ");

    return NextResponse.json({
      success: true,
      message: guildId
        ? `Pomyślnie zarejestrowano ${registered.length} komend na serwerze (${commandNames}). Komendy są aktywne NATYCHMIAST!`
        : `Pomyślnie zarejestrowano ${registered.length} komend globalnie (${commandNames}). Propagacja może potrwać do kilkunastu minut.`,
      commands: registered,
      isGuild: !!guildId,
    });
  } catch (err) {
    console.error("[discord-commands] error:", err);
    return NextResponse.json(
      {
        message: "Wystąpił błąd połączenia z API Discorda.",
      },
      { status: 500 }
    );
  }
}
