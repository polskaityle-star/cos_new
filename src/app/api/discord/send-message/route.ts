import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { COLORS, DiscordChannel, sendToChannel } from "@/lib/discord";
import { canAccessManagementPanel, getRoleLabel } from "@/lib/roles";
import { rateLimit } from "@/lib/rateLimit";

const ALLOWED_CHANNELS: DiscordChannel[] = [
  "WIADOMOSCI",
  "GRAFIK",
  "USTERKI",
  "RAPORTY",
  "REKRUTACJA",
  "KONTAKT",
];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ message: "Musisz być zalogowany, aby wysyłać wiadomości na Discord." }, { status: 401 });
  }

  // Rate limit: 10 na minutę na użytkownika
  const rlKey = `discord-send:user:${session.user.id}`;
  if (!rateLimit(rlKey, 10, 60 * 1000)) {
    return NextResponse.json(
      { message: "Zbyt wiele wiadomości. Limit to 10 wiadomości na minutę." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    let channel: DiscordChannel = "WIADOMOSCI";

    if (body?.channel && ALLOWED_CHANNELS.includes(body.channel)) {
      channel = body.channel;
    }

    // Uprawnienia do kanałów: kanały poza WIADOMOSCI wymagają canAccessManagementPanel
    const hasStaffAccess = canAccessManagementPanel(session.user.role);
    if (!hasStaffAccess && channel !== "WIADOMOSCI") {
      return NextResponse.json(
        { message: "Brak uprawnień do wysyłania wiadomości na ten kanał Discord." },
        { status: 403 }
      );
    }

    if (!content) {
      return NextResponse.json({ message: "Treść wiadomości nie może być pusta." }, { status: 400 });
    }

    if (title.length > 100) {
      return NextResponse.json({ message: "Tytuł wiadomości może mieć maksymalnie 100 znaków." }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ message: "Wiadomość może mieć maksymalnie 2000 znaków." }, { status: 400 });
    }

    const badge = session.user.badgeNumber || null;
    const displayName = session.user.discordUsername || session.user.username;
    const roleLabel = getRoleLabel(session.user.role);
    const sender = badge ? `${badge} ${displayName}` : displayName;

    const ok = await sendToChannel(
      channel,
      [
        {
          title: title || `Wiadomość z portalu VZTM Kielce`,
          description: content,
          color: COLORS.info,
          fields: [
            { name: "Nadawca", value: sender, inline: true },
            { name: "Rola", value: roleLabel, inline: true },
            { name: "Kanał", value: channel, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
      `💬 **Wiadomość z portalu VZTM Kielce** od **${sender}**:`
    );

    if (!ok) {
      const webhookEnv = process.env[`DISCORD_WEBHOOK_${channel}`] || process.env.DISCORD_WEBHOOK_URL;
      if (!webhookEnv) {
        return NextResponse.json(
          {
            message: `Brak skonfigurowanego webhooka dla kanału ${channel} (ustaw zmienną DISCORD_WEBHOOK_${channel} lub DISCORD_WEBHOOK_URL w Vercel).`,
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { message: "Nie udało się doręczyć wiadomości do webhooka Discorda. Sprawdź czy URL webhooka jest poprawny." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Wiadomość została pomyślnie wysłana na kanał ${channel} na Discordzie!`,
    });
  } catch (err) {
    console.error("[discord/send-message] error:", err);
    return NextResponse.json({ message: "Wystąpił błąd podczas wysyłania wiadomości." }, { status: 500 });
  }
}
