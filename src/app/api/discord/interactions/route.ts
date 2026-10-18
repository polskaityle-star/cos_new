import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDiscordRequest } from "@/lib/discordVerify";
import { COLORS, DiscordEmbed, embed, siteUrl } from "@/lib/discord";
import { getRoleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

const EPHEMERAL = 64;
const TZ = "Europe/Warsaw";

function reply(embeds: DiscordEmbed[], content?: string) {
  return NextResponse.json({
    type: 4,
    data: { content, embeds: embeds.map(embed), flags: EPHEMERAL, allowed_mentions: { parse: [] } },
  });
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

function todayUtcMidnight(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${s}T00:00:00.000Z`);
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "zaplanowana",
  COMPLETED: "zrealizowana",
  MISSED: "niezaliczona",
  CANCELLED: "anulowana",
};

async function dutiesBetween(userId: string, from: Date, to: Date) {
  return prisma.duty.findMany({
    where: { userId, date: { gte: from, lt: to }, status: { not: "CANCELLED" } },
    include: { line: true, vehicle: true, replacementVehicle: true },
    orderBy: { date: "asc" },
    take: 15,
  });
}

function dutyLine(d: Awaited<ReturnType<typeof dutiesBetween>>[number]): string {
  const veh = d.replacementVehicle || d.vehicle;
  const parts = [
    `**${fmtDate(d.date)}** - linia **${d.line.number}**`,
    d.brigade ? `brygada ${d.brigade}` : null,
    veh ? `pojazd #${veh.fleetNumber}${d.replacementVehicle ? " (zastępczy)" : ""}` : null,
    `_${STATUS_LABEL[d.status] ?? d.status.toLowerCase()}_`,
  ].filter(Boolean);
  return parts.join(" • ");
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyDiscordRequest(raw, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"))) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  if (body.type === 1) return NextResponse.json({ type: 1 }); // PING
  if (body.type !== 2) return NextResponse.json({ type: 1 });

  const name: string = body.data?.name;
  const discordId: string | undefined = body.member?.user?.id ?? body.user?.id;
  const site = siteUrl();

  try {
    // Komendy publiczne (bez powiązanego konta)
    if (name === "linie") {
      const lines = await prisma.line.findMany({ orderBy: { number: "asc" }, take: 30 });
      return reply([
        {
          title: "Linie VZTM Kielce",
          color: COLORS.info,
          description: lines.length
            ? lines.map((l) => `**${l.number}** ${l.startStop || ""} ⇄ ${l.endStop || ""}`.trim()).join("\n")
            : "Brak zdefiniowanych linii.",
          url: `${site}/linie`,
        },
      ]);
    }

    if (name === "tabor") {
      const vehicles = await prisma.vehicle.findMany({ select: { carrier: true, status: true } });
      const counts: Record<string, Record<string, number>> = {};
      for (const v of vehicles) {
        const c = (counts[v.carrier] ||= {});
        c[v.status] = (c[v.status] ?? 0) + 1;
      }
      const byCarrier: Record<string, string[]> = {};
      for (const [carrier, statuses] of Object.entries(counts)) {
        byCarrier[carrier] = Object.entries(statuses).map(([status, n]) => `${status.toLowerCase()}: **${n}**`);
      }
      return reply([
        {
          title: "Stan taboru",
          color: COLORS.info,
          fields: Object.entries(byCarrier).map(([carrier, rows]) => ({ name: carrier, value: rows.join("\n"), inline: true })),
          url: `${site}/tabor`,
        },
      ]);
    }

    // Komendy wymagające powiązanego konta
    const user = discordId ? await prisma.user.findUnique({ where: { discordId } }) : null;
    if (!user) {
      return reply([
        {
          title: "Konto niepowiązane",
          color: COLORS.warn,
          description: `Zaloguj się na ${site}/login i w panelu użyj przycisku **Połącz z Discordem**, a potem spróbuj ponownie.`,
        },
      ]);
    }
    if (user.status !== "ACCEPTED") {
      return reply([{ title: "Konto nieaktywne", color: COLORS.warn, description: "Twoje konto nie zostało jeszcze zaakceptowane przez Zarząd." }]);
    }

    if (name === "grafik" || name === "sluzba") {
      const from = todayUtcMidnight();
      const days = name === "sluzba" ? 2 : 7;
      const to = new Date(from.getTime() + days * 24 * 3600 * 1000);
      const duties = await dutiesBetween(user.id, from, to);
      return reply([
        {
          title: name === "sluzba" ? "Twoja służba (dziś i jutro)" : "Twój grafik na 7 dni",
          color: COLORS.info,
          description: duties.length ? duties.map(dutyLine).join("\n") : "Brak zaplanowanych służb w tym okresie.",
          url: `${site}/panel/kierowca`,
        },
      ]);
    }

    if (name === "status") {
      const [missed, pending] = await Promise.all([
        prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
        prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
      ]);
      return reply([
        {
          title: `${user.username}${user.badgeNumber ? ` [${user.badgeNumber}]` : ""}`,
          color: user.suspended ? COLORS.bad : COLORS.ok,
          fields: [
            { name: "Rola", value: getRoleLabel(user.role), inline: true },
            { name: "Przewoźnik", value: user.carrier || "-", inline: true },
            { name: "Etat (dni)", value: user.workingDays || "nie wybrano", inline: true },
            { name: "Niezaliczone służby", value: String(missed), inline: true },
            { name: "Wnioski oczekujące", value: String(pending), inline: true },
            { name: "Konto", value: user.suspended ? "ZAWIESZONE" : "aktywne", inline: true },
          ],
          url: `${site}/panel/kierowca`,
        },
      ]);
    }

    return reply([{ title: "Nieznana komenda", color: COLORS.warn }]);
  } catch (err) {
    console.error("[discord] interaction error", (err as Error)?.message);
    return reply([{ title: "Błąd", color: COLORS.bad, description: "Nie udało się pobrać danych. Spróbuj ponownie za chwilę." }]);
  }
}
