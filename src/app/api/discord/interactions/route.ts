import { isSafeStoredFile, isTrustedImageHost, formatScreenshotForDiscord } from "@/lib/files";
import { rateLimit } from "@/lib/rateLimit";
import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDiscordRequest } from "@/lib/discordVerify";
import { COLORS, DiscordEmbed, embed, siteUrl, sendToChannel, runAfter } from "@/lib/discord";
import { getRoleLabel } from "@/lib/roles";
import { getZarzadPermissions, parseZarzadCustomId } from "@/lib/discordZarzad";
import { reviewRequest } from "@/lib/requests";
import { reviewReport } from "@/lib/reports";
import { reviewDefect } from "@/lib/defects";
import { reviewCandidate } from "@/lib/recruitment";

export const dynamic = "force-dynamic";

const EPHEMERAL = 64;
const TZ = "Europe/Warsaw";

interface DiscordInteractionBody {
  id?: string;
  application_id?: string;
  token?: string;
  type?: number;
  data?: {
    id?: string;
    name?: string;
    custom_id?: string;
    components?: Array<{
      type?: number;
      components?: Array<{
        type?: number;
        custom_id?: string;
        value?: string;
      }>;
    }>;
    options?: Array<{
      name?: string;
      type?: number;
      value?: unknown;
    }>;
  };
  member?: {
    user?: {
      id?: string;
      username?: string;
      global_name?: string;
    };
    roles?: string[];
  };
  user?: {
    id?: string;
    username?: string;
    global_name?: string;
  };
}

interface ModalTextInput {
  customId: string;
  label: string;
  style?: 1 | 2; // 1 = Short, 2 = Paragraph
  placeholder?: string;
  value?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

function reply(embeds: DiscordEmbed[], content?: string, components?: unknown[]) {
  return NextResponse.json({
    type: 4,
    data: {
      content,
      embeds: embeds.map(embed),
      components: components && components.length > 0 ? components : undefined,
      flags: EPHEMERAL,
      allowed_mentions: { parse: [] },
    },
  });
}

function modalResponse(customId: string, title: string, inputs: ModalTextInput[]) {
  return NextResponse.json({
    type: 9,
    data: {
      custom_id: customId.slice(0, 100),
      title: title.slice(0, 45),
      components: inputs.slice(0, 5).map((inp) => ({
        type: 1, // ACTION_ROW
        components: [
          {
            type: 4, // TEXT_INPUT
            custom_id: inp.customId.slice(0, 100),
            label: inp.label.slice(0, 45),
            style: inp.style ?? 1,
            placeholder: inp.placeholder?.slice(0, 100),
            value: inp.value?.slice(0, 4000),
            required: inp.required ?? true,
            min_length: inp.minLength,
            max_length: inp.maxLength,
          },
        ],
      })),
    },
  });
}

/** Aktualizuje odroczoną (deferred) odpowiedź Discorda przez webhook tokenu interakcji */
async function updateDeferred(
  appId: string,
  token: string,
  embeds: DiscordEmbed[],
  content?: string,
  components?: unknown[]
) {
  if (!appId || !token) return;
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: content || null,
        embeds: embeds.map(embed),
        components: components && components.length > 0 ? components : [],
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("[discord follow-up error]:", res.status, txt);
    }
  } catch (err) {
    console.error("[discord follow-up fetch error]:", err);
  }
}

function getModalValues(body: DiscordInteractionBody): Record<string, string> {
  const result: Record<string, string> = {};
  const rows = body.data?.components;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (Array.isArray(r.components)) {
        for (const c of r.components) {
          if (c.custom_id) {
            result[c.custom_id] = (c.value ?? "").trim();
          }
        }
      }
    }
  }
  return result;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function fmtDateShort(d: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function todayUtcMidnight(): Date {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${s}T00:00:00.000Z`);
}

function endOfTodayUtc(): Date {
  const start = todayUtcMidnight();
  return new Date(start.getTime() + 24 * 3600 * 1000 - 1);
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "zaplanowana",
  COMPLETED: "zrealizowana",
  MISSED: "niezaliczona",
  CANCELLED: "anulowana",
  ODROBIONA: "odrobiona",
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

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ status: "ok" });
  }
  const site = siteUrl(req);
  return NextResponse.json({
    status: "ok",
    service: "VZTM Kielce Discord Interactions Endpoint",
    configured: {
      hasPublicKey: !!process.env.DISCORD_PUBLIC_KEY,
      hasBotToken: !!process.env.DISCORD_BOT_TOKEN,
      hasGuildId: !!process.env.DISCORD_GUILD_ID,
      hasAppId: !!(process.env.DISCORD_APP_ID || process.env.DISCORD_CLIENT_ID),
    },
    endpointUrl: `${site}/api/discord/interactions`,
    instructions:
      "Wklej ten adres w Discord Developer Portal -> Twoja Aplikacja -> General Information -> Interactions Endpoint URL.",
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");

  if (!verifyDiscordRequest(raw, sig, ts)) {
    console.error("[discord/interactions] 401 signature verification failed! Check DISCORD_PUBLIC_KEY.");
    return new NextResponse("invalid request signature", { status: 401 });
  }

  let body: DiscordInteractionBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  // 1. PING (type: 1) - weryfikacja URL przez Discord Developer Portal
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Akceptujemy wyłącznie znane typy interakcji
  if (body.type !== 2 && body.type !== 3 && body.type !== 5) {
    return NextResponse.json({ type: 1 });
  }

  const site = siteUrl(req);
  const discordId: string | undefined = body.member?.user?.id ?? body.user?.id;
  const appId = body.application_id || process.env.DISCORD_APP_ID || process.env.DISCORD_CLIENT_ID || "";
  const token = body.token || "";

  // -------------------------------------------------------------
  // SZYBKIE MODALE BEZ ZAPYTAŃ DO BAZY (zwracane natychmiast)
  // -------------------------------------------------------------
  if (body.type === 2) {
    const name = body.data?.name;
    if (name === "usterka") {
      return modalResponse("modal_defect", "Zgłoszenie usterki pojazdu", [
        {
          customId: "fleet_number",
          label: "Numer taborowy pojazdu",
          style: 1,
          placeholder: "np. 101, 204",
          required: true,
          maxLength: 10,
        },
        {
          customId: "title",
          label: "Tytuł usterki / krótki opis",
          style: 1,
          placeholder: "np. Awaria drzwi II, niesprawny układ hamulcowy",
          required: true,
          maxLength: 100,
        },
        {
          customId: "description",
          label: "Dokładny opis uszkodzenia / awarii",
          style: 2,
          placeholder: "Opisz okoliczności zdarzenia, objawy usterki oraz stan pojazdu",
          required: true,
          maxLength: 1000,
        },
        {
          customId: "photo_url",
          label: "Link do zdjęcia / screena (opcjonalnie)",
          style: 1,
          placeholder: "https://... (Discord, Imgur) lub brak",
          required: false,
          maxLength: 300,
        },
      ]);
    }

    if (name === "wniosek") {
      return modalResponse("modal_request", "Wniosek kierowcy", [
        {
          customId: "type",
          label: "Typ (URLOP/DODATKOWA/ETAT/ANULUJ/INNE)",
          style: 1,
          placeholder: "Wpisz: URLOP, DODATKOWA, ETAT, ANULOWANIE lub INNE",
          value: "URLOP",
          required: true,
          maxLength: 30,
        },
        {
          customId: "date_start",
          label: "Data od (RRRR-MM-DD)",
          style: 1,
          placeholder: "np. 2026-10-25 (dla urlopu/służby)",
          required: false,
          maxLength: 10,
        },
        {
          customId: "date_end",
          label: "Data do (RRRR-MM-DD)",
          style: 1,
          placeholder: "np. 2026-10-30 (dla urlopu)",
          required: false,
          maxLength: 10,
        },
        {
          customId: "reason",
          label: "Uzasadnienie / powód wniosku",
          style: 2,
          placeholder: "Wpisz powód lub szczegółowe uzasadnienie wniosku",
          required: true,
          maxLength: 500,
        },
        {
          customId: "details",
          label: "Dodatkowe informacje (opcjonalnie)",
          style: 1,
          placeholder: "np. preferowany pojazd lub zmiana dni tygodnia",
          required: false,
          maxLength: 200,
        },
      ]);
    }
  }

  if (body.type === 3) {
    const customId = body.data?.custom_id || "";
    if (customId === "btn_action_defect") {
      return modalResponse("modal_defect", "Zgłoszenie usterki pojazdu", [
        {
          customId: "fleet_number",
          label: "Numer taborowy pojazdu",
          style: 1,
          placeholder: "np. 101, 204",
          required: true,
          maxLength: 10,
        },
        {
          customId: "title",
          label: "Tytuł usterki / krótki opis",
          style: 1,
          placeholder: "np. Awaria drzwi II, niesprawny układ hamulcowy",
          required: true,
          maxLength: 100,
        },
        {
          customId: "description",
          label: "Dokładny opis uszkodzenia / awarii",
          style: 2,
          placeholder: "Opisz okoliczności zdarzenia, objawy usterki oraz stan pojazdu",
          required: true,
          maxLength: 1000,
        },
        {
          customId: "photo_url",
          label: "Link do zdjęcia / screena (opcjonalnie)",
          style: 1,
          placeholder: "https://... (Discord, Imgur) lub brak",
          required: false,
          maxLength: 300,
        },
      ]);
    }

    if (customId === "btn_action_request") {
      return modalResponse("modal_request", "Wniosek kierowcy", [
        {
          customId: "type",
          label: "Typ (URLOP/DODATKOWA/ETAT/ANULUJ/INNE)",
          style: 1,
          placeholder: "Wpisz: URLOP, DODATKOWA, ETAT, ANULOWANIE lub INNE",
          value: "URLOP",
          required: true,
          maxLength: 30,
        },
        {
          customId: "date_start",
          label: "Data od (RRRR-MM-DD)",
          style: 1,
          placeholder: "np. 2026-10-25 (dla urlopu/służby)",
          required: false,
          maxLength: 10,
        },
        {
          customId: "date_end",
          label: "Data do (RRRR-MM-DD)",
          style: 1,
          placeholder: "np. 2026-10-30 (dla urlopu)",
          required: false,
          maxLength: 10,
        },
        {
          customId: "reason",
          label: "Uzasadnienie / powód wniosku",
          style: 2,
          placeholder: "Wpisz powód lub szczegółowe uzasadnienie wniosku",
          required: true,
          maxLength: 500,
        },
        {
          customId: "details",
          label: "Dodatkowe informacje (opcjonalnie)",
          style: 1,
          placeholder: "np. preferowany pojazd lub zmiana dni tygodnia",
          required: false,
          maxLength: 200,
        },
      ]);
    }

    if (customId.startsWith("btn_report_")) {
      const dutyId = customId.replace("btn_report_", "");
      const duty = await prisma.duty.findUnique({
        where: { id: dutyId },
        select: {
          id: true,
          userId: true,
          date: true,
          line: { select: { number: true } },
          vehicle: { select: { mileage: true } },
          replacementVehicle: { select: { mileage: true } },
          report: { select: { id: true } },
        },
      });

      if (!duty) {
        return reply([{ title: "Służba nie znaleziona", color: COLORS.bad, description: "Nie znaleziono wybranej służby." }]);
      }
      if (duty.report) {
        return reply([{ title: "Raport już złożony", color: COLORS.warn, description: "Dla tej służby raport został już wcześniej złożony." }]);
      }

      const initialMileage = String(duty.replacementVehicle?.mileage ?? duty.vehicle?.mileage ?? 0);
      return modalResponse(`modal_report_${duty.id}`, `Raport: L.${duty.line.number} ${fmtDateShort(duty.date)}`, [
        {
          customId: "start_mileage",
          label: "Stan początkowy licznika (km)",
          style: 1,
          value: initialMileage,
          required: true,
          maxLength: 10,
        },
        {
          customId: "end_mileage",
          label: "Stan końcowy licznika (km)",
          style: 1,
          placeholder: "np. 210540",
          required: true,
          maxLength: 10,
        },
        {
          customId: "start_screenshot",
          label: "Screen wyjazdu / pulpitu (link URL)",
          style: 1,
          placeholder: "https://... lub wpisz link do screena",
          required: true,
          maxLength: 300,
        },
        {
          customId: "end_screenshot",
          label: "Screen zjazdu / końca (link URL)",
          style: 1,
          placeholder: "https://... lub wpisz link do screena",
          required: true,
          maxLength: 300,
        },
        {
          customId: "summary_file",
          label: "Karta drogowa / uwagi ze służby",
          style: 2,
          placeholder: "Wpisz przebieg służby, ewentualne opóźnienia lub link do logu OMSI 2",
          required: true,
          maxLength: 1000,
        },
      ]);
    }
  }

  // -------------------------------------------------------------
  // DLA WSZYSTKICH POZOSTAŁYCH ZAPYTAŃ:
  // ODPOWIADAMY NATYCHMIAST TYPE: 5 (DEFERRED EPHEMERAL) LUB TYPE: 6,
  // A PRACĘ WYKONUJEMY ASYNCHRONICZNIE W after()!
  // Zapobiega to timeoutowi 3 sekund w Discordzie ("Aplikacja nie reaguje").
  // -------------------------------------------------------------

  after(async () => {
    try {
      // Helper do pobierania konta powiązanego
      const user = discordId
        ? await prisma.user.findUnique({
            where: { discordId },
            include: { assignedVehicle: true },
          })
        : null;

      // Obsługa komend publicznych (linie, tabor)
      if (body.type === 2) {
        const name = body.data?.name;
        if (name === "linie") {
          const lines = await prisma.line.findMany({ orderBy: { number: "asc" }, take: 30 });
          await updateDeferred(appId, token, [
            {
              title: "Linie VZTM Kielce",
              color: COLORS.info,
              description: lines.length
                ? lines.map((l) => `**${l.number}** ${l.startStop || ""} ⇄ ${l.endStop || ""}`.trim()).join("\n")
                : "Brak zdefiniowanych linii.",
              url: `${site}/linie`,
            },
          ]);
          return;
        }



        if (name === "tabor") {
          const vehicles = await prisma.vehicle.findMany({ select: { carrier: true, status: true } });
          const counts: Record<string, Record<string, number>> = {};
          for (const v of vehicles) {
            const c = v.carrier || "Inne";
            const st = (v.status || "SPRAWNY").toLowerCase();
            counts[c] = counts[c] || {};
            counts[c][st] = (counts[c][st] || 0) + 1;
          }
          const fields = Object.entries(counts).map(([carrier, statusMap]) => ({
            name: carrier,
            value: Object.entries(statusMap).map(([st, cnt]) => `${st}: **${cnt}**`).join("\n") || "Brak pojazdów",
            inline: true,
          }));
          await updateDeferred(appId, token, [
            {
              title: "Stan taboru",
              color: COLORS.info,
              fields,
              url: `${site}/tabor`,
            },
          ]);
          return;
        }
      }

      // Weryfikacja powiązania konta kierowcy
      if (!user) {
        if ((body.type === 2 && body.data?.name === "zarzad") || (body.type === 3 && (body.data?.custom_id || "").startsWith("zarzad_"))) {
          await updateDeferred(appId, token, [
            {
              title: "Brak uprawnień",
              color: COLORS.bad,
              description: "Brak uprawnień do panelu zarządu.",
            },
          ]);
          return;
        }
        await updateDeferred(appId, token, [
          {
            title: "Konto niepowiązane z VZTM Kielce",
            color: COLORS.warn,
            description: `Twoje konto Discord nie jest powiązane z profilem kierowcy w systemie VZTM Kielce.\n\nZaloguj się na **${site}/login** i w swoim panelu kliknij **Połącz z Discordem**, aby uzyskać dostęp do panelu, służb, raportów i wniosków.`,
            url: `${site}/login`,
          },
        ]);
        return;
      }

      if (user.status !== "ACCEPTED") {
        if ((body.type === 2 && body.data?.name === "zarzad") || (body.type === 3 && (body.data?.custom_id || "").startsWith("zarzad_"))) {
          await updateDeferred(appId, token, [
            {
              title: "Brak uprawnień",
              color: COLORS.bad,
              description: "Brak uprawnień do panelu zarządu.",
            },
          ]);
          return;
        }
        await updateDeferred(appId, token, [
          {
            title: "Konto oczekuje na akceptację",
            color: COLORS.warn,
            description: `Twoje konto (${user.username}) nie zostało jeszcze zaakceptowane przez Zarząd VZTM Kielce.`,
          },
        ]);
        return;
      }

      const badge = user.badgeNumber || "Kierowca";
      const driverLabel = `${badge} ${user.username}`;

      // Helper do budowania panelu kierowcy
      const sendPanel = async () => {
        const [missedCount, pendingRequests, uncompletedDuties, upcomingDuties] = await Promise.all([
          prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
          prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
          prisma.duty.findMany({
            where: {
              userId: user.id,
              report: null,
              status: { in: ["SCHEDULED", "MISSED"] },
              date: { lte: endOfTodayUtc() },
            },
            include: { line: true, vehicle: true, replacementVehicle: true },
            orderBy: { date: "desc" },
            take: 5,
          }),
          prisma.duty.findMany({
            where: {
              userId: user.id,
              status: "SCHEDULED",
              date: { gte: todayUtcMidnight() },
            },
            include: { line: true, vehicle: true, replacementVehicle: true },
            orderBy: { date: "asc" },
            take: 2,
          }),
        ]);

        const fields = [
          { name: "Kierowca", value: driverLabel, inline: true },
          { name: "Rola", value: getRoleLabel(user.role), inline: true },
          { name: "Przewoźnik", value: user.carrier || "-", inline: true },
          { name: "Etat (dni)", value: user.workingDays || "brak", inline: true },
          {
            name: "Stały pojazd",
            value: user.assignedVehicle ? `#${user.assignedVehicle.fleetNumber} (${user.assignedVehicle.model})` : "brak",
            inline: true,
          },
          { name: "Stan konta", value: user.suspended ? "⛔ ZAWIESZONE" : "✅ Aktywne", inline: true },
          {
            name: "Służby do zaraportowania",
            value: uncompletedDuties.length > 0 ? `⚠️ **${uncompletedDuties.length}** służb(y) czeka na raport!` : "✅ Wszystko rozliczone",
            inline: true,
          },
          { name: "Niezaliczone służby", value: String(missedCount), inline: true },
          { name: "Wnioski w toku", value: String(pendingRequests), inline: true },
        ];

        if (upcomingDuties.length > 0) {
          fields.push({
            name: "Najbliższa służba",
            value: upcomingDuties.map(dutyLine).join("\n"),
            inline: false,
          });
        }

        const zarzadNavButtons: unknown[] = [
          { type: 2, style: 2, custom_id: "btn_action_grafik", label: "📅 Mój grafik" },
          { type: 2, style: 2, custom_id: "btn_action_status", label: "📊 Mój status" },
        ];
        if (getZarzadPermissions(user.role).canAccess) {
          zarzadNavButtons.push({ type: 2, style: 1, custom_id: "zarzad_menu", label: "👑 Panel Zarządu" });
        }
        zarzadNavButtons.push({ type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" });

        const components = [
          {
            type: 1, // ActionRow 1
            components: [
              { type: 2, style: 1, custom_id: "btn_action_raport", label: "📝 Złóż raport" },
              { type: 2, style: 2, custom_id: "btn_action_defect", label: "🔧 Zgłoś usterkę" },
              { type: 2, style: 2, custom_id: "btn_action_request", label: "📋 Złóż wniosek" },
            ],
          },
          {
            type: 1, // ActionRow 2
            components: zarzadNavButtons,
          },
        ];

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Panel Kierowcy - ${driverLabel}`,
              color: user.suspended ? COLORS.bad : COLORS.info,
              fields,
              url: `${site}/panel/kierowca`,
            },
          ],
          undefined,
          components
        );
      };

      // Helper do budowania menu wyboru służby do raportu
      const sendReportMenu = async () => {
        const pendingDuties = await prisma.duty.findMany({
          where: {
            userId: user.id,
            report: null,
            status: { in: ["SCHEDULED", "MISSED"] },
            date: { lte: endOfTodayUtc() },
          },
          include: { line: true, vehicle: true, replacementVehicle: true },
          orderBy: { date: "desc" },
          take: 5,
        });

        if (pendingDuties.length === 0) {
          await updateDeferred(
            appId,
            token,
            [
              {
                title: "Brak służb do zaraportowania",
                color: COLORS.ok,
                description: `🎉 Wszystkie Twoje dotychczasowe służby mają już złożony raport lub nie masz zaplanowanych służb na dzień dzisiejszy i przeszłość.\n\nNowe służby pojawią się w grafiku zgodnie z Twoim etatem.`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 2, custom_id: "btn_action_grafik", label: "📅 Grafik służb" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        const dutyButtons = pendingDuties.slice(0, 4).map((d) => ({
          type: 2,
          style: 1,
          custom_id: `btn_report_${d.id}`,
          label: `Raport: ${fmtDateShort(d.date)} (L: ${d.line.number})`,
        }));

        const desc = [
          `Masz **${pendingDuties.length}** służb(y) oczekujących na złożenie raportu:`,
          "",
          ...pendingDuties.map(
            (d) => `• **${fmtDate(d.date)}** - Linia **${d.line.number}** (${d.brigade || "brak brygady"}), wóz: #${d.replacementVehicle?.fleetNumber ?? d.vehicle?.fleetNumber ?? "brak"}`
          ),
          "",
          "Kliknij odpowiedni przycisk poniżej, aby otworzyć formularz raportu w Discordzie:",
        ].join("\n");

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Wybierz służbę do zaraportowania - ${driverLabel}`,
              color: COLORS.warn,
              description: desc,
            },
          ],
          undefined,
          [
            { type: 1, components: dutyButtons },
            {
              type: 1,
              components: [
                { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Złóż na stronie" },
              ],
            },
          ]
        );
      };

      // Helper do budowania menu panelu zarządu
      const sendZarzadMenu = async () => {
        const perms = getZarzadPermissions(user.role);
        const [pendingReqCount, pendingRepCount, newDefectsCount, pendingCandCount] = await Promise.all([
          perms.canRequests ? prisma.driverRequest.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
          perms.canReports ? prisma.report.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
          perms.canFleet ? prisma.vehicleDefect.count({ where: { status: "NOWE" } }) : Promise.resolve(0),
          perms.canUsers ? prisma.user.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
        ]);

        const fields = [
          { name: "Zarządzający", value: driverLabel, inline: true },
          { name: "Rola", value: getRoleLabel(user.role), inline: true },
        ];

        if (perms.canRequests) {
          fields.push({
            name: "Wnioski PENDING",
            value: pendingReqCount > 0 ? `⚠️ **${pendingReqCount}** do decyzji` : "✅ Brak",
            inline: true,
          });
        }
        if (perms.canReports) {
          fields.push({
            name: "Raporty PENDING",
            value: pendingRepCount > 0 ? `⚠️ **${pendingRepCount}** do decyzji` : "✅ Brak",
            inline: true,
          });
        }
        if (perms.canFleet) {
          fields.push({
            name: "Usterki NOWE",
            value: newDefectsCount > 0 ? `⚠️ **${newDefectsCount}** nowych` : "✅ Brak",
            inline: true,
          });
        }
        if (perms.canUsers) {
          fields.push({
            name: "Kandydaci PENDING",
            value: pendingCandCount > 0 ? `⚠️ **${pendingCandCount}** oczekuje` : "✅ Brak",
            inline: true,
          });
        }

        const actionButtons: unknown[] = [];
        if (perms.canRequests) {
          actionButtons.push({ type: 2, style: 1, custom_id: "zarzad_req_list:0", label: "📋 Wnioski" });
        }
        if (perms.canReports) {
          actionButtons.push({ type: 2, style: 1, custom_id: "zarzad_rep_list:0", label: "📝 Raporty" });
        }
        if (perms.canFleet) {
          actionButtons.push({ type: 2, style: 1, custom_id: "zarzad_def_list:0", label: "🔧 Usterki" });
        }
        if (perms.canUsers) {
          actionButtons.push({ type: 2, style: 1, custom_id: "zarzad_cand_list:0", label: "👥 Rekrutacja" });
        }

        const navButtons: unknown[] = [
          { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
          { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
        ];

        const components: unknown[] = [];
        if (actionButtons.length > 0) {
          components.push({ type: 1, components: actionButtons });
        }
        components.push({ type: 1, components: navButtons });

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Panel Zarządu - ${driverLabel}`,
              color: COLORS.info,
              description: "Szybkie akcje oraz podgląd spraw wymagających decyzji Zarządu.",
              fields,
              url: `${site}/panel/zarzad`,
            },
          ],
          undefined,
          components
        );
      };

      // Helper do wyświetlania listy wniosków z przyciskami decyzji
      const sendRequestsList = async (offset = 0) => {
        const total = await prisma.driverRequest.count({
          where: { status: "PENDING" },
        });

        if (total === 0) {
          await updateDeferred(
            appId,
            token,
            [
              {
                title: "Brak oczekujących wniosków",
                color: COLORS.ok,
                description: "🎉 Wszystkie wnioski kierowców zostały już rozpatrzone. Brak pozycji oczekujących (PENDING).",
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Panel Zarządu" },
                  { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        const clampedOffset = Math.max(0, Math.min(offset, total - 1));
        const pendingRequests = await prisma.driverRequest.findMany({
          where: { status: "PENDING" },
          include: { user: true },
          orderBy: { createdAt: "asc" },
          skip: clampedOffset,
          take: 1,
        });

        const req = pendingRequests[0];
        if (!req) return;

        const reqDriverBadge = req.user.badgeNumber || "Kierowca";
        const reqDriverName = `${reqDriverBadge} ${req.user.username}`;

        const fields = [
          { name: "Kierowca", value: reqDriverName, inline: true },
          { name: "Typ wniosku", value: req.type, inline: true },
          { name: "Złożono", value: fmtDate(req.createdAt), inline: true },
        ];

        if (req.dateStart) {
          const dates = req.dateEnd
            ? `${fmtDateShort(req.dateStart)} ➔ ${fmtDateShort(req.dateEnd)}`
            : fmtDateShort(req.dateStart);
          fields.push({ name: "Termin", value: dates, inline: true });
        }

        if (req.reason) {
          fields.push({ name: "Powód", value: req.reason.slice(0, 1000), inline: false });
        }

        if (req.details) {
          if (req.type === "STALY_POJAZD" || req.type === "ZMIANA_STALEGO_POJAZDU") {
            const targetVehicle = await prisma.vehicle.findUnique({
              where: { id: req.details },
            });
            const vehDisplay = targetVehicle
              ? `#${targetVehicle.fleetNumber} (${targetVehicle.model}) [${targetVehicle.carrier || "VMPK"}]`
              : "Nieznany pojazd";
            fields.push({ name: "Wnioskowany pojazd", value: vehDisplay, inline: false });
          } else {
            fields.push({ name: "Szczegóły", value: req.details.slice(0, 500), inline: false });
          }
        }

        const actionButtons = [
          { type: 2, style: 3, custom_id: `zarzad_req_approve:${req.id}`, label: "✅ Zatwierdź" },
          { type: 2, style: 4, custom_id: `zarzad_req_reject:${req.id}`, label: "❌ Odrzuć" },
        ];

        const navButtons = [];
        if (clampedOffset > 0) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_req_list:${clampedOffset - 1}`, label: "⬅️ Poprzedni" });
        }
        if (clampedOffset < total - 1) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_req_list:${clampedOffset + 1}`, label: "➡️ Następny" });
        }
        navButtons.push({ type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" });
        navButtons.push({ type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" });

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Wniosek [${clampedOffset + 1}/${total}]: ${req.type}`,
              color: COLORS.warn,
              fields,
              url: `${site}/panel/zarzad`,
            },
          ],
          undefined,
          [
            { type: 1, components: actionButtons },
            { type: 1, components: navButtons },
          ]
        );
      };

      // Helper do wyświetlania listy raportów ze służb z przyciskami decyzji
      const sendReportsList = async (offset = 0) => {
        const total = await prisma.report.count({
          where: { status: "PENDING" },
        });

        if (total === 0) {
          await updateDeferred(
            appId,
            token,
            [
              {
                title: "Brak oczekujących raportów",
                color: COLORS.ok,
                description: "🎉 Wszystkie raporty ze służb zostały już rozpatrzone. Brak pozycji oczekujących (PENDING).",
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Panel Zarządu" },
                  { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        const clampedOffset = Math.max(0, Math.min(offset, total - 1));
        const pendingReports = await prisma.report.findMany({
          where: { status: "PENDING" },
          include: {
            duty: {
              include: {
                user: true,
                line: true,
                vehicle: true,
                replacementVehicle: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
          skip: clampedOffset,
          take: 1,
        });

        const rep = pendingReports[0];
        if (!rep) return;

        const repDriverBadge = rep.duty?.user?.badgeNumber || "Kierowca";
        const repDriverName = `${repDriverBadge} ${rep.duty?.user?.username ?? "Nieznany"}`;
        const veh = rep.duty?.replacementVehicle || rep.duty?.vehicle;
        const distance = Math.max(0, rep.endMileage - rep.startMileage);

        const fields = [
          { name: "Kierowca", value: repDriverName, inline: true },
          {
            name: "Służba / Linia",
            value: `Linia ${rep.duty?.line?.number ?? "-"}, data: ${rep.duty?.date ? fmtDate(rep.duty.date) : "-"}`,
            inline: true,
          },
          {
            name: "Pojazd",
            value: veh ? `#${veh.fleetNumber} (${veh.model})` : "-",
            inline: true,
          },
          {
            name: "Przebieg",
            value: `${rep.startMileage} km ➔ ${rep.endMileage} km (Dystans: **${distance} km**)`,
            inline: false,
          },
        ];

        if (rep.summaryFile) {
          fields.push({ name: "Uwagi / karta drogowa", value: rep.summaryFile.slice(0, 1000), inline: false });
        }

        const screenshotItems: string[] = [];
        const startDisplay = formatScreenshotForDiscord(rep.startScreenshot, "Screen wyjazdu");
        if (startDisplay) screenshotItems.push(startDisplay);
        const endDisplay = formatScreenshotForDiscord(rep.endScreenshot, "Screen zjazdu");
        if (endDisplay) screenshotItems.push(endDisplay);

        if (screenshotItems.length > 0) {
          fields.push({ name: "Zrzuty ekranu", value: screenshotItems.join("\n"), inline: false });
        }

        fields.push({
          name: "Podgląd pełny",
          value: `Pełne pliki i załączniki dostępne w [Panelu WWW](${site}/panel/zarzad).`,
          inline: false,
        });

        const actionButtons = [
          { type: 2, style: 3, custom_id: `zarzad_rep_approve:${rep.id}`, label: "✅ Zatwierdź" },
          { type: 2, style: 4, custom_id: `zarzad_rep_reject:${rep.id}`, label: "❌ Odrzuć" },
        ];

        const navButtons = [];
        if (clampedOffset > 0) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_rep_list:${clampedOffset - 1}`, label: "⬅️ Poprzedni" });
        }
        if (clampedOffset < total - 1) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_rep_list:${clampedOffset + 1}`, label: "➡️ Następny" });
        }
        navButtons.push({ type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" });
        navButtons.push({ type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" });

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Raport [${clampedOffset + 1}/${total}]: Linia ${rep.duty?.line?.number ?? "-"} (${repDriverName})`,
              color: COLORS.warn,
              fields,
              url: `${site}/panel/zarzad`,
            },
          ],
          undefined,
          [
            { type: 1, components: actionButtons },
            { type: 1, components: navButtons },
          ]
        );
      };

      // Helper do wyświetlania listy nowych usterek
      const sendDefectsList = async (offset = 0) => {
        const total = await prisma.vehicleDefect.count({
          where: { status: "NOWE" },
        });

        if (total === 0) {
          await updateDeferred(
            appId,
            token,
            [
              {
                title: "Brak nowych usterek",
                color: COLORS.ok,
                description: "🎉 Wszystkie zgłoszone usterki pojazdów zostały już skierowane do warsztatu lub naprawione. Brak pozycji ze statusem NOWE.",
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Panel Zarządu" },
                  { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        const clampedOffset = Math.max(0, Math.min(offset, total - 1));
        const pendingDefects = await prisma.vehicleDefect.findMany({
          where: { status: "NOWE" },
          include: { vehicle: true, user: true },
          orderBy: { createdAt: "asc" },
          skip: clampedOffset,
          take: 1,
        });

        const defect = pendingDefects[0];
        if (!defect) return;

        const reporterBadge = defect.user?.badgeNumber || "Kierowca";
        const reporterName = defect.user ? `${reporterBadge} ${defect.user.username}` : "Nieznany";

        const fields = [
          { name: "Pojazd", value: `#${defect.vehicle.fleetNumber} (${defect.vehicle.model})`, inline: true },
          { name: "Zgłaszający", value: reporterName, inline: true },
          { name: "Zgłoszono", value: fmtDate(defect.createdAt), inline: true },
          { name: "Tytuł usterki", value: defect.title, inline: false },
          { name: "Opis usterki", value: defect.description ? defect.description.slice(0, 1000) : "Brak", inline: false },
        ];

        if (defect.defectType) {
          fields.push({ name: "Kategoria", value: defect.defectType, inline: true });
        }

        const actionButtons = [
          { type: 2, style: 1, custom_id: `zarzad_def_repair:${defect.id}`, label: "🔧 Skieruj na warsztat" },
          { type: 2, style: 4, custom_id: `zarzad_def_reject:${defect.id}`, label: "❌ Odrzuć" },
        ];

        const navButtons = [];
        if (clampedOffset > 0) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_def_list:${clampedOffset - 1}`, label: "⬅️ Poprzednia" });
        }
        if (clampedOffset < total - 1) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_def_list:${clampedOffset + 1}`, label: "➡️ Następna" });
        }
        navButtons.push({ type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" });
        navButtons.push({ type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" });

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Usterka [${clampedOffset + 1}/${total}]: Pojazd #${defect.vehicle.fleetNumber}`,
              color: COLORS.warn,
              fields,
              url: `${site}/panel/zarzad`,
            },
          ],
          undefined,
          [
            { type: 1, components: actionButtons },
            { type: 1, components: navButtons },
          ]
        );
      };

      // Helper do wyświetlania listy oczekujących kandydatów (rekrutacja)
      const sendCandidatesList = async (offset = 0) => {
        const total = await prisma.user.count({
          where: { status: "PENDING" },
        });

        if (total === 0) {
          await updateDeferred(
            appId,
            token,
            [
              {
                title: "Brak oczekujących kandydatów",
                color: COLORS.ok,
                description: "🎉 Wszystkie zgłoszenia rekrutacyjne zostały już rozpatrzone. Brak kandydatów ze statusem PENDING.",
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Panel Zarządu" },
                  { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        const clampedOffset = Math.max(0, Math.min(offset, total - 1));
        const pendingCandidates = await prisma.user.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          skip: clampedOffset,
          take: 1,
        });

        const cand = pendingCandidates[0];
        if (!cand) return;

        const carrierDisplay =
          cand.carrier === "VMPK" || cand.carrier === "VBP" ? cand.carrier : "nie wybrano";

        const fields = [
          { name: "Kandydat", value: cand.username, inline: true },
          { name: "Przewoźnik", value: carrierDisplay, inline: true },
          { name: "Wiek", value: cand.age ? `${cand.age} lat` : "Nie podano", inline: true },
          { name: "Zarejestrowano", value: fmtDate(cand.createdAt), inline: true },
        ];

        if (cand.bio) {
          fields.push({ name: "O sobie / Doświadczenie", value: cand.bio.slice(0, 1000), inline: false });
        }

        const actionButtons = [];
        if (cand.carrier === "VMPK" || cand.carrier === "VBP") {
          actionButtons.push({
            type: 2,
            style: 3,
            custom_id: `zarzad_cand_approve:${cand.id}`,
            label: `✅ Zatwierdź (${cand.carrier})`,
          });
        } else {
          actionButtons.push(
            { type: 2, style: 3, custom_id: `zarzad_cand_approve_vmpk:${cand.id}`, label: "✅ Zatwierdź (VMPK)" },
            { type: 2, style: 3, custom_id: `zarzad_cand_approve_vbp:${cand.id}`, label: "✅ Zatwierdź (VBP)" }
          );
        }
        actionButtons.push({ type: 2, style: 4, custom_id: `zarzad_cand_reject:${cand.id}`, label: "❌ Odrzuć" });

        const navButtons = [];
        if (clampedOffset > 0) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_cand_list:${clampedOffset - 1}`, label: "⬅️ Poprzedni" });
        }
        if (clampedOffset < total - 1) {
          navButtons.push({ type: 2, style: 2, custom_id: `zarzad_cand_list:${clampedOffset + 1}`, label: "➡️ Następny" });
        }
        navButtons.push({ type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" });
        navButtons.push({ type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" });

        await updateDeferred(
          appId,
          token,
          [
            {
              title: `Kandydat [${clampedOffset + 1}/${total}]: ${cand.username}`,
              color: COLORS.warn,
              fields,
              url: `${site}/panel/zarzad`,
            },
          ],
          undefined,
          [
            { type: 1, components: actionButtons },
            { type: 1, components: navButtons },
          ]
        );
      };

      // ---------------------------------------------------------
      // OBSŁUGA KOMEND SLASH (type: 2)
      // ---------------------------------------------------------
      if (body.type === 2) {
        const name = body.data?.name;

        if (name === "zarzad") {
          if (user.suspended || !getZarzadPermissions(user.role).canAccess) {
            await updateDeferred(appId, token, [
              {
                title: "Brak uprawnień",
                color: COLORS.bad,
                description: "Brak uprawnień do panelu zarządu.",
              },
            ]);
            return;
          }
          if (!rateLimit("zarzad:" + user.id, 30, 10 * 60 * 1000)) {
            await updateDeferred(appId, token, [
              {
                title: "Przekroczono limit akcji",
                color: COLORS.warn,
                description: "Zbyt wiele akcji panelu zarządu. Limit to 30 akcji na 10 minut.",
              },
            ]);
            return;
          }
          await sendZarzadMenu();
          return;
        }

        if (name === "panel") {
          await sendPanel();
          return;
        }

        if (name === "raport") {
          await sendReportMenu();
          return;
        }

        if (name === "grafik" || name === "sluzba") {
          const from = todayUtcMidnight();
          const days = name === "sluzba" ? 2 : 7;
          const to = new Date(from.getTime() + days * 24 * 3600 * 1000);
          const duties = await dutiesBetween(user.id, from, to);
          await updateDeferred(
            appId,
            token,
            [
              {
                title: name === "sluzba" ? `Twoja służba (dziś i jutro) - ${driverLabel}` : `Twój grafik na 7 dni - ${driverLabel}`,
                color: COLORS.info,
                description: duties.length ? duties.map(dutyLine).join("\n") : "Brak zaplanowanych służb w tym okresie.",
                url: `${site}/panel/kierowca`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 1, custom_id: "btn_action_raport", label: "📝 Raporty" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        if (name === "status") {
          const [missed, pending] = await Promise.all([
            prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
            prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
          ]);
          await updateDeferred(
            appId,
            token,
            [
              {
                title: `Status kierowcy - ${driverLabel}`,
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
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 1, custom_id: "btn_action_raport", label: "📝 Raporty" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        await updateDeferred(appId, token, [{ title: "Nieznana komenda", color: COLORS.warn }]);
        return;
      }

      // ---------------------------------------------------------
      // OBSŁUGA PRZYCISKÓW NAWIGACJI (type: 3)
      // ---------------------------------------------------------
      if (body.type === 3) {
        const customId = body.data?.custom_id || "";

        if (customId.startsWith("zarzad_")) {
          if (user.suspended || !getZarzadPermissions(user.role).canAccess) {
            await updateDeferred(appId, token, [
              {
                title: "Brak uprawnień",
                color: COLORS.bad,
                description: "Brak uprawnień do panelu zarządu.",
              },
            ]);
            return;
          }
          if (!rateLimit("zarzad:" + user.id, 30, 10 * 60 * 1000)) {
            await updateDeferred(appId, token, [
              {
                title: "Przekroczono limit akcji",
                color: COLORS.warn,
                description: "Zbyt wiele akcji panelu zarządu. Limit to 30 akcji na 10 minut.",
              },
            ]);
            return;
          }

          const parsed = parseZarzadCustomId(customId);
          if (!parsed) {
            await updateDeferred(appId, token, [
              {
                title: "Nieprawidłowe żądanie",
                color: COLORS.bad,
                description: "Nieprawidłowy lub nieznany identyfikator akcji.",
              },
            ]);
            return;
          }

          const perms = getZarzadPermissions(user.role);

          if (parsed.action === "menu") {
            await sendZarzadMenu();
            return;
          }

          if (parsed.action === "req_list") {
            if (!perms.canRequests) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do rozpatrywania wniosków." },
              ]);
              return;
            }
            await sendRequestsList(parsed.offset ?? 0);
            return;
          }

          if (parsed.action === "req_approve" || parsed.action === "req_reject") {
            if (!perms.canRequests) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do rozpatrywania wniosków." },
              ]);
              return;
            }
            const requestId = parsed.targetId!;
            const action = parsed.action === "req_approve" ? "accept" : "reject";

            const result = await reviewRequest({
              requestId,
              action,
              rejectReason: action === "reject" ? "Odrzucono przez zarząd w Discordzie" : undefined,
              reviewerId: user.id,
              reviewerRole: user.role,
            });

            if (!result.ok) {
              await updateDeferred(
                appId,
                token,
                [
                  {
                    title: "Nie można przetworzyć wniosku",
                    color: COLORS.bad,
                    description: result.message,
                  },
                ],
                undefined,
                [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, custom_id: "zarzad_req_list:0", label: "📋 Wróć do wniosków" },
                      { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    ],
                  },
                ]
              );
              return;
            }

            await updateDeferred(
              appId,
              token,
              [
                {
                  title: action === "accept" ? "✅ Wniosek zaakceptowany" : "❌ Wniosek odrzucony",
                  color: action === "accept" ? COLORS.ok : COLORS.bad,
                  description: `Wniosek został pomyślnie ${action === "accept" ? "zaakceptowany" : "odrzucony"}.\nKierowca został powiadomiony.`,
                },
              ],
              undefined,
              [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, custom_id: "zarzad_req_list:0", label: "📋 Kolejne wnioski" },
                    { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                  ],
                },
              ]
            );
            return;
          }

          if (parsed.action === "rep_list") {
            if (!perms.canReports) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do sprawdzania raportów." },
              ]);
              return;
            }
            await sendReportsList(parsed.offset ?? 0);
            return;
          }

          if (parsed.action === "rep_approve" || parsed.action === "rep_reject") {
            if (!perms.canReports) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do sprawdzania raportów." },
              ]);
              return;
            }
            const reportId = parsed.targetId!;
            const action = parsed.action === "rep_approve" ? "accept" : "reject";

            const result = await reviewReport({
              reportId,
              action,
              reviewerId: user.id,
              reviewerRole: user.role,
            });

            if (!result.ok) {
              await updateDeferred(
                appId,
                token,
                [
                  {
                    title: "Nie można przetworzyć raportu",
                    color: COLORS.bad,
                    description: result.message,
                  },
                ],
                undefined,
                [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, custom_id: "zarzad_rep_list:0", label: "📝 Wróć do raportów" },
                      { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    ],
                  },
                ]
              );
              return;
            }

            await updateDeferred(
              appId,
              token,
              [
                {
                  title: action === "accept" ? "✅ Raport zaakceptowany" : "❌ Raport odrzucony",
                  color: action === "accept" ? COLORS.ok : COLORS.bad,
                  description: `Raport został pomyślnie ${action === "accept" ? "zaakceptowany" : "odrzucony"}.\nKierowca został powiadomiony.`,
                },
              ],
              undefined,
              [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, custom_id: "zarzad_rep_list:0", label: "📝 Kolejne raporty" },
                    { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                  ],
                },
              ]
            );
            return;
          }

          if (parsed.action === "def_list") {
            if (!perms.canFleet) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do zarządzania taborem." },
              ]);
              return;
            }
            await sendDefectsList(parsed.offset ?? 0);
            return;
          }

          if (parsed.action === "def_repair" || parsed.action === "def_fixed" || parsed.action === "def_reject") {
            if (!perms.canFleet) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do zarządzania taborem." },
              ]);
              return;
            }
            const defectId = parsed.targetId!;
            const newStatus =
              parsed.action === "def_repair"
                ? "WARSZTAT"
                : parsed.action === "def_reject"
                  ? "ODRZUCONE"
                  : "NAPRAWIONE";

            const result = await reviewDefect({
              defectId,
              status: newStatus,
              reviewerId: user.id,
            });

            if (!result.ok) {
              await updateDeferred(
                appId,
                token,
                [
                  {
                    title: "Nie można zaktualizować usterki",
                    color: COLORS.bad,
                    description: result.message,
                  },
                ],
                undefined,
                [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, custom_id: "zarzad_def_list:0", label: "🔧 Wróć do usterek" },
                      { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    ],
                  },
                ]
              );
              return;
            }

            const actionTitle =
              newStatus === "WARSZTAT"
                ? "🔧 Skierowano do warsztatu"
                : newStatus === "ODRZUCONE"
                  ? "❌ Usterka odrzucona"
                  : "✅ Oznaczono jako naprawione";

            await updateDeferred(
              appId,
              token,
              [
                {
                  title: actionTitle,
                  color: newStatus === "ODRZUCONE" ? COLORS.bad : newStatus === "WARSZTAT" ? COLORS.warn : COLORS.ok,
                  description: `Status usterki oraz pojazdu został zaktualizowany (${newStatus}).`,
                },
              ],
              undefined,
              [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, custom_id: "zarzad_def_list:0", label: "🔧 Kolejne usterki" },
                    { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                  ],
                },
              ]
            );
            return;
          }

          if (parsed.action === "cand_list") {
            if (!perms.canUsers) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do zarządzania użytkownikami." },
              ]);
              return;
            }
            await sendCandidatesList(parsed.offset ?? 0);
            return;
          }

          if (
            parsed.action === "cand_approve" ||
            parsed.action === "cand_approve_vmpk" ||
            parsed.action === "cand_approve_vbp" ||
            parsed.action === "cand_reject"
          ) {
            if (!perms.canUsers) {
              await updateDeferred(appId, token, [
                { title: "Brak uprawnień", color: COLORS.bad, description: "Brak uprawnień do zarządzania użytkownikami." },
              ]);
              return;
            }
            const userId = parsed.targetId!;
            const action = parsed.action === "cand_reject" ? "reject" : "accept";
            let chosenCarrier = undefined;
            if (parsed.action === "cand_approve_vmpk") chosenCarrier = "VMPK";
            if (parsed.action === "cand_approve_vbp") chosenCarrier = "VBP";

            const result = await reviewCandidate({
              userId,
              action,
              carrier: chosenCarrier,
              reviewerId: user.id,
              reviewerRole: user.role,
            });

            if (!result.ok) {
              await updateDeferred(
                appId,
                token,
                [
                  {
                    title: "Nie można rozpatrzyć kandydata",
                    color: COLORS.bad,
                    description: result.message,
                  },
                ],
                undefined,
                [
                  {
                    type: 1,
                    components: [
                      { type: 2, style: 1, custom_id: "zarzad_cand_list:0", label: "👥 Wróć do kandydatów" },
                      { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    ],
                  },
                ]
              );
              return;
            }

            await updateDeferred(
              appId,
              token,
              [
                {
                  title: action === "accept" ? "✅ Kandydat zaakceptowany" : "❌ Kandydat odrzucony",
                  color: action === "accept" ? COLORS.ok : COLORS.bad,
                  description: `Kandydat został pomyślnie ${action === "accept" ? `zaakceptowany (${result.user?.carrier || chosenCarrier || "VMPK"}, służbowy badge: ${result.user?.badgeNumber || "-"})` : "odrzucony"}.`,
                },
              ],
              undefined,
              [
                {
                  type: 1,
                  components: [
                    { type: 2, style: 1, custom_id: "zarzad_cand_list:0", label: "👥 Kolejni kandydaci" },
                    { type: 2, style: 2, custom_id: "zarzad_menu", label: "👑 Menu Zarządu" },
                    { type: 2, style: 5, url: `${site}/panel/zarzad`, label: "🌐 Panel WWW" },
                  ],
                },
              ]
            );
            return;
          }
        }

        if (customId === "btn_action_panel") {
          await sendPanel();
          return;
        }

        if (customId === "btn_action_raport") {
          await sendReportMenu();
          return;
        }

        if (customId === "btn_action_grafik") {
          const from = todayUtcMidnight();
          const to = new Date(from.getTime() + 7 * 24 * 3600 * 1000);
          const duties = await dutiesBetween(user.id, from, to);
          await updateDeferred(
            appId,
            token,
            [
              {
                title: `Twój grafik na 7 dni - ${driverLabel}`,
                color: COLORS.info,
                description: duties.length ? duties.map(dutyLine).join("\n") : "Brak zaplanowanych służb w tym okresie.",
                url: `${site}/panel/kierowca`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 1, custom_id: "btn_action_raport", label: "📝 Raporty" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        if (customId === "btn_action_status") {
          const [missed, pending] = await Promise.all([
            prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
            prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
          ]);
          await updateDeferred(
            appId,
            token,
            [
              {
                title: `Status kierowcy - ${driverLabel}`,
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
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 1, custom_id: "btn_action_raport", label: "📝 Raporty" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        await updateDeferred(appId, token, [{ title: "Nieznana akcja", color: COLORS.warn }]);
        return;
      }

      // ---------------------------------------------------------
      // OBSŁUGA ZATWIERDZENIA MODALU (type: 5)
      // ---------------------------------------------------------
      if (body.type === 5) {
        const customId = body.data?.custom_id || "";
        const values = getModalValues(body);

        // A. Raport ze służby
        if (customId.startsWith("modal_report_")) {
          if (user.suspended) {
            await updateDeferred(appId, token, [
              {
                title: "Konto zawieszone",
                color: COLORS.bad,
                description: "Twoje konto kierowcy jest zawieszone. Nie możesz składać raportów ze służb.",
              },
            ]);
            return;
          }
          const dutyId = customId.replace("modal_report_", "");
          const duty = await prisma.duty.findUnique({
            where: { id: dutyId },
            include: { line: true, vehicle: true, replacementVehicle: true, report: true },
          });

          if (!duty || duty.userId !== user.id) {
            await updateDeferred(appId, token, [
              {
                title: "Służba nie znaleziona",
                color: COLORS.bad,
                description: "Nie znaleziono służby lub brak uprawnień.",
              },
            ]);
            return;
          }

          if (duty.report) {
            await updateDeferred(appId, token, [
              {
                title: "Raport już istnieje",
                color: COLORS.warn,
                description: `Raport dla tej służby został już zarejestrowany w systemie.`,
              },
            ]);
            return;
          }

          const todayWarsaw = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
          const dutyWarsaw = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(duty.date);
          if (dutyWarsaw > todayWarsaw) {
            await updateDeferred(appId, token, [
              {
                title: "Służba z przyszłości",
                color: COLORS.warn,
                description: `Służba jest zaplanowana na przyszłość (${fmtDate(duty.date)}). Raport możesz złożyć dopiero w dniu odbywania służby lub po jej zakończeniu.`,
              },
            ]);
            return;
          }

          const startMileageNum = Number(values.start_mileage);
          const endMileageNum = Number(values.end_mileage);

          if (
            !Number.isInteger(startMileageNum) ||
            !Number.isInteger(endMileageNum) ||
            startMileageNum < 0 ||
            endMileageNum < 0 ||
            endMileageNum < startMileageNum ||
            endMileageNum - startMileageNum > 2000 ||
            endMileageNum > 2_000_000_000
          ) {
            await updateDeferred(appId, token, [
              {
                title: "Nieprawidłowy przebieg",
                color: COLORS.bad,
                description: "Przebiegi muszą być liczbami całkowitymi >= 0, stan końcowy nie może być mniejszy niż początkowy, maksymalny dystans na służbie to 2000 km, a licznik nie może przekraczać 2 000 000 000 km.",
              },
            ]);
            return;
          }
          const startMileage = startMileageNum;
          const endMileage = endMileageNum;

          const rawStart = (values.start_screenshot || "").trim();
          const rawEnd = (values.end_screenshot || "").trim();
          if (
            !rawStart.startsWith("https://") ||
            !isSafeStoredFile(rawStart, "image") ||
            !rawEnd.startsWith("https://") ||
            !isSafeStoredFile(rawEnd, "image")
          ) {
            await updateDeferred(appId, token, [
              {
                title: "Nieprawidłowe linki do zrzutów ekranu",
                color: COLORS.bad,
                description: "Zrzuty ekranu muszą być prawidłowymi linkami zaczynającymi się od https://.",
              },
            ]);
            return;
          }
          const startScreenshot = rawStart;
          const endScreenshot = rawEnd;

          const rawSummary = (values.summary_file || "Raport złożony przez bota Discord").trim();
          const summaryFile = rawSummary.slice(0, 1000);

          const veh = duty.replacementVehicle || duty.vehicle;
          const kmDiff = Math.max(0, endMileage - startMileage);

          await prisma.$transaction([
            prisma.report.create({
              data: {
                dutyId: duty.id,
                startMileage,
                endMileage,
                startScreenshot,
                endScreenshot,
                summaryFile,
                status: "PENDING",
              },
            }),
            prisma.duty.update({
              where: { id: duty.id },
              data: { status: "COMPLETED" },
            }),
          ]);

          await runAfter(() =>
            sendToChannel("RAPORTY", [
              {
                title: "Nowy raport ze służby (Discord)",
                color: COLORS.info,
                fields: [
                  { name: "Kierowca", value: driverLabel, inline: true },
                  {
                    name: "Służba",
                    value: `${fmtDate(duty.date)} • Linia ${duty.line.number}${duty.brigade ? ` (${duty.brigade})` : ""}`,
                    inline: true,
                  },
                  { name: "Przebieg", value: `${kmDiff} km (${startMileage} ➔ ${endMileage})`, inline: true },
                  { name: "Pojazd", value: veh ? `#${veh.fleetNumber} (${veh.model})` : "-", inline: true },
                  { name: "Uwagi", value: summaryFile.slice(0, 500), inline: false },
                  {
                    name: "Zrzuty ekranu",
                    value: `[Wyjazd/Start](${startScreenshot.startsWith("http") ? startScreenshot : site}) • [Zjazd/Koniec](${endScreenshot.startsWith("http") ? endScreenshot : site})`,
                    inline: false,
                  },
                ],
                url: `${site}/panel/zarzad`,
              },
            ])
          );

          await updateDeferred(
            appId,
            token,
            [
              {
                title: "✅ Raport został pomyślnie złożony!",
                color: COLORS.ok,
                description: `Twój raport ze służby z dnia **${fmtDate(duty.date)}** (linia **${duty.line.number}**) został pomyślnie zapisany w systemie VZTM Kielce.\n\n• Przejechano: **${kmDiff} km** (${startMileage} km ➔ ${endMileage} km)\n• Status służby: **COMPLETED**\n• Status raportu: **Oczekuje na akceptację Zarządu**\n\nRaport jest już widoczny w Twoim panelu kierowcy na stronie.`,
                url: `${site}/panel/kierowca`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        // B. Usterka pojazdu
        if (customId === "modal_defect") {
          // Rate limit: 5 zgłoszeń na godzinę na użytkownika
          const rlKey = `defect:discord:${user.id}`;
          if (!rateLimit(rlKey, 5, 60 * 60 * 1000)) {
            await updateDeferred(appId, token, [
              {
                title: "Zbyt wiele zgłoszeń",
                color: COLORS.bad,
                description: "Przekroczono limit zgłoszeń usterek (maksymalnie 5 na godzinę). Spróbuj ponownie później.",
              },
            ]);
            return;
          }

          const fleetNum = values.fleet_number?.trim();
          const title = values.title?.trim();
          const description = values.description?.trim();
          const photoUrl = values.photo_url?.trim();

          if (!fleetNum || !title || !description) {
            await updateDeferred(appId, token, [
              {
                title: "Brak wymaganych pól",
                color: COLORS.bad,
                description: "Wypełnij numer taborowy, tytuł usterki oraz opis awarii.",
              },
            ]);
            return;
          }

          const vehicles = await prisma.vehicle.findMany({
            where: {
              fleetNumber: fleetNum,
              carrier: user.carrier ?? undefined,
            },
          });

          if (vehicles.length === 0) {
            await updateDeferred(appId, token, [
              {
                title: "Nie znaleziono pojazdu",
                color: COLORS.bad,
                description: `W bazie taboru VZTM Kielce nie ma pojazdu o numerze taborowym **#${fleetNum}**${user.carrier ? ` u przewoźnika **${user.carrier}**` : ""}.\nSprawdź poprawny numer za pomocą komendy \`/tabor\` i spróbuj ponownie.`,
              },
            ]);
            return;
          }

          if (vehicles.length > 1) {
            await updateDeferred(appId, token, [
              {
                title: "Niejednoznaczny numer pojazdu",
                color: COLORS.warn,
                description: `Znaleziono więcej niż jeden pojazd o numerze **#${fleetNum}**. Prosimy o zgłoszenie usterki przez panel WWW lub doprecyzowanie pojazdu.`,
              },
            ]);
            return;
          }

          const vehicle = vehicles[0];

          let photoList: string[] = [];
          if (photoUrl && photoUrl.startsWith("https://") && isSafeStoredFile(photoUrl, "image")) {
            photoList = [photoUrl];
          }

          await prisma.$transaction([
            prisma.vehicleDefect.create({
              data: {
                userId: user.id,
                vehicleId: vehicle.id,
                title: title.slice(0, 100),
                description: description.slice(0, 1000),
                photos: JSON.stringify(photoList),
                status: "NOWE",
              },
            }),
            prisma.vehicle.update({
              where: { id: vehicle.id },
              data: { status: "WARSZTAT" },
            }),
          ]);

          await runAfter(() =>
            sendToChannel("USTERKI", [
              {
                title: `Nowa usterka: #${vehicle.fleetNumber} - ${title}`,
                color: COLORS.bad,
                description,
                fields: [
                  { name: "Zgłaszający", value: driverLabel, inline: true },
                  { name: "Pojazd", value: `#${vehicle.fleetNumber} (${vehicle.model})`, inline: true },
                  { name: "Przewoźnik", value: vehicle.carrier, inline: true },
                  { name: "Status pojazdu", value: "WARSZTAT", inline: true },
                  {
                    name: "Zdjęcie",
                    value: photoList.length > 0 ? `[Zobacz zdjęcie](${photoList[0]})` : "Brak zdjęcia",
                    inline: true,
                  },
                ],
                url: `${site}/tabor`,
              },
            ])
          );

          await updateDeferred(
            appId,
            token,
            [
              {
                title: "✅ Usterka została zarejestrowana!",
                color: COLORS.ok,
                description: `Zgłoszenie usterki pojazdu **#${vehicle.fleetNumber} (${vehicle.model})** zostało przyjęte.\n\n• Tytuł: **${title}**\n• Status pojazdu: **WARSZTAT**\n\nDział techniczny i warsztat zostały powiadomione.`,
                url: `${site}/tabor`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 5, url: `${site}/tabor`, label: "🌐 Stan taboru" },
                ],
              },
            ]
          );
          return;
        }

        // C. Wniosek kierowcy
        if (customId === "modal_request") {
          const rawType = (values.type || "").toUpperCase().trim();
          const reason = values.reason?.trim();
          const details = values.details?.trim();

          if (!reason) {
            await updateDeferred(appId, token, [
              {
                title: "Brak uzasadnienia",
                color: COLORS.bad,
                description: "Uzasadnienie wniosku jest wymagane.",
              },
            ]);
            return;
          }

          const ALLOWED_REQUEST_TYPES = [
            "URLOP",
            "DODATKOWA_SLUZBA",
            "ZMIANA_ETATU",
            "ANULOWANIE_SLUZBY",
            "ODWIESZENIE",
            "STALY_POJAZD",
            "INNE",
          ] as const;

          let requestType: (typeof ALLOWED_REQUEST_TYPES)[number] = "INNE";
          if (rawType.includes("URLOP")) requestType = "URLOP";
          else if (rawType.includes("DODATKOW")) requestType = "DODATKOWA_SLUZBA";
          else if (rawType.includes("ETAT")) requestType = "ZMIANA_ETATU";
          else if (rawType.includes("ANULOW")) requestType = "ANULOWANIE_SLUZBY";
          else if (rawType.includes("ODWIESZ")) requestType = "ODWIESZENIE";
          else if (rawType.includes("POJAZD")) requestType = "STALY_POJAZD";
          else if (ALLOWED_REQUEST_TYPES.includes(rawType as any)) requestType = rawType as any;
          else requestType = "INNE";

          if (user.suspended && requestType !== "ODWIESZENIE") {
            await updateDeferred(appId, token, [
              {
                title: "Konto zawieszone",
                color: COLORS.bad,
                description: "Twoje konto jest zawieszone. Możesz złożyć wyłącznie wniosek o ODWIESZENIE.",
              },
            ]);
            return;
          }

          let dStart: Date | null = null;
          let dEnd: Date | null = null;

          if (values.date_start) {
            const s = new Date(values.date_start.trim());
            if (!isNaN(s.getTime())) dStart = s;
          }
          if (values.date_end) {
            const e = new Date(values.date_end.trim());
            if (!isNaN(e.getTime())) dEnd = e;
          }

          if (requestType === "URLOP") {
            if (!dStart || !dEnd) {
              await updateDeferred(appId, token, [
                {
                  title: "Wymagane daty urlopu",
                  color: COLORS.bad,
                  description: "Dla wniosku o urlop wymagane jest podanie obu poprawnych dat (od i do) w formacie RRRR-MM-DD.",
                },
              ]);
              return;
            }
            if (dEnd.getTime() < dStart.getTime()) {
              await updateDeferred(appId, token, [
                {
                  title: "Nieprawidłowy zakres dat",
                  color: COLORS.bad,
                  description: "Data zakończenia urlopu nie może być wcześniejsza niż data rozpoczęcia.",
                },
              ]);
              return;
            }
            const diffDays = Math.floor((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > 14) {
              await updateDeferred(appId, token, [
                {
                  title: "Zbyt długi urlop",
                  color: COLORS.warn,
                  description: "Urlop przez wniosek może wynosić maksymalnie 14 dni. W przypadku dłuższego urlopu skontaktuj się z Zarządem.",
                },
              ]);
              return;
            }
          }

          await prisma.driverRequest.create({
            data: {
              userId: user.id,
              type: requestType,
              reason: reason.slice(0, 500),
              dateStart: dStart,
              dateEnd: dEnd,
              details: details ? details.slice(0, 200) : null,
              status: "PENDING",
            },
          });

          await runAfter(() =>
            sendToChannel("WNIOSKI", [
              {
                title: `Nowy wniosek: ${requestType}`,
                color: COLORS.warn,
                description: reason,
                fields: [
                  { name: "Kierowca", value: driverLabel, inline: true },
                  { name: "Typ", value: requestType, inline: true },
                  {
                    name: "Termin",
                    value: dStart && dEnd ? `${values.date_start} ➔ ${values.date_end}` : dStart ? values.date_start : "Brak",
                    inline: true,
                  },
                  ...(details ? [{ name: "Szczegóły", value: details, inline: false }] : []),
                ],
                url: `${site}/panel/zarzad`,
              },
            ])
          );

          await updateDeferred(
            appId,
            token,
            [
              {
                title: "✅ Wniosek został pomyślnie złożony!",
                color: COLORS.ok,
                description: `Twój wniosek (**${requestType}**) został zarejestrowany w systemie i oczekuje na decyzję Zarządu.\n\n• Powód: **${reason}**\n${dStart ? `• Termin: **${values.date_start}${values.date_end ? ` do ${values.date_end}` : ""}**\n` : ""}• Status: **Oczekuje na rozpatrzenie (PENDING)**`,
                url: `${site}/panel/kierowca`,
              },
            ],
            undefined,
            [
              {
                type: 1,
                components: [
                  { type: 2, style: 2, custom_id: "btn_action_panel", label: "⬅️ Panel kierowcy" },
                  { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
                ],
              },
            ]
          );
          return;
        }

        await updateDeferred(appId, token, [{ title: "Nieznany formularz", color: COLORS.warn }]);
        return;
      }
    } catch (err) {
      console.error("[discord interactions async error]:", err);
      await updateDeferred(appId, token, [
        {
          title: "Błąd bota",
          color: COLORS.bad,
          description: "Wystąpił błąd podczas przetwarzania żądania. Spróbuj ponownie za chwilę.",
        },
      ]);
    }
  });

  // Natychmiastowa odpowiedź odroczona (< 15 ms):
  // Dla type: 3 (przycisk nawigacji) -> type: 6 (aktualizacja istniejącej wiadomości)
  // Dla pozostałych -> type: 5 (nowa wiadomość odroczona, efemeryczna)
  if (body.type === 3) {
    return NextResponse.json({ type: 6 });
  }

  return NextResponse.json({
    type: 5,
    data: { flags: EPHEMERAL },
  });
}
