import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDiscordRequest } from "@/lib/discordVerify";
import { COLORS, DiscordEmbed, embed, siteUrl, sendToChannel, runAfter } from "@/lib/discord";
import { getRoleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

const EPHEMERAL = 64;
const TZ = "Europe/Warsaw";

interface DiscordInteractionBody {
  id?: string;
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

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyDiscordRequest(raw, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"))) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  let body: DiscordInteractionBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  // PING (type: 1)
  if (body.type === 1) return NextResponse.json({ type: 1 });

  // Discord interaction types:
  // 2 = APPLICATION_COMMAND (Slash command)
  // 3 = MESSAGE_COMPONENT (Buttons)
  // 5 = MODAL_SUBMIT
  if (body.type !== 2 && body.type !== 3 && body.type !== 5) {
    return NextResponse.json({ type: 1 });
  }

  const site = siteUrl(req);
  const discordId: string | undefined = body.member?.user?.id ?? body.user?.id;

  try {
    // -------------------------------------------------------------
    // 1. KOMENDY PUBLICZNE (type: 2, bez powiązanego konta)
    // -------------------------------------------------------------
    if (body.type === 2) {
      const name = body.data?.name;

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
        return reply([
          {
            title: "Stan taboru",
            color: COLORS.info,
            fields,
            url: `${site}/tabor`,
          },
        ]);
      }
    }

    // -------------------------------------------------------------
    // WERYFIKACJA UŻYTKOWNIKA (K-xxx / W1 z powiązanym kontem Discord)
    // -------------------------------------------------------------
    const user = discordId
      ? await prisma.user.findUnique({
          where: { discordId },
          include: { assignedVehicle: true },
        })
      : null;

    if (!user) {
      return reply([
        {
          title: "Konto niepowiązane z VZTM Kielce",
          color: COLORS.warn,
          description: `Twoje konto Discord nie jest powiązane z profilem kierowcy.\n\nZaloguj się na **${site}/login** i w panelu kliknij **Połącz z Discordem**, aby uzyskać dostęp do swoich służb, raportów i wniosków.`,
          url: `${site}/login`,
        },
      ]);
    }

    if (user.status !== "ACCEPTED") {
      return reply([
        {
          title: "Konto oczekuje na akceptację",
          color: COLORS.warn,
          description: `Twoje konto (${user.username}) nie zostało jeszcze zaakceptowane przez Zarząd VZTM Kielce.`,
        },
      ]);
    }

    const badge = user.role === "ZARZAD" ? "W1" : (user.badgeNumber || "Kierowca");
    const driverLabel = `${badge} ${user.username}`;

    // Helper do budowania panelu kierowcy
    const buildPanelResponse = async () => {
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
          components: [
            { type: 2, style: 2, custom_id: "btn_action_grafik", label: "📅 Mój grafik" },
            { type: 2, style: 2, custom_id: "btn_action_status", label: "📊 Mój status" },
            { type: 2, style: 5, url: `${site}/panel/kierowca`, label: "🌐 Panel WWW" },
          ],
        },
      ];

      return reply(
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

    // Helper do wyświetlania listy służb oczekujących na raport
    const buildReportMenuResponse = async () => {
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
        return reply(
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
      }

      // Przyciski do złożenia raportu dla każdej ze służb
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

      return reply(
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

    // Helper do otwierania modalu usterki
    const openDefectModal = () => {
      return modalResponse("modal_defect", "Zgłoszenie usterki pojazdu", [
        {
          customId: "fleet_number",
          label: "Numer taborowy pojazdu",
          style: 1,
          placeholder: "np. 101, 204",
          value: user.assignedVehicle?.fleetNumber ?? "",
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
    };

    // Helper do otwierania modalu wniosku
    const openRequestModal = () => {
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
    };

    // -------------------------------------------------------------
    // 2. OBSŁUGA KOMEND SLASH (type: 2)
    // -------------------------------------------------------------
    if (body.type === 2) {
      const name = body.data?.name;

      if (name === "panel") {
        return await buildPanelResponse();
      }

      if (name === "raport") {
        return await buildReportMenuResponse();
      }

      if (name === "usterka") {
        return openDefectModal();
      }

      if (name === "wniosek") {
        return openRequestModal();
      }

      if (name === "grafik" || name === "sluzba") {
        const from = todayUtcMidnight();
        const days = name === "sluzba" ? 2 : 7;
        const to = new Date(from.getTime() + days * 24 * 3600 * 1000);
        const duties = await dutiesBetween(user.id, from, to);
        return reply(
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
      }

      if (name === "status") {
        const [missed, pending] = await Promise.all([
          prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
          prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
        ]);
        return reply(
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
      }

      return reply([{ title: "Nieznana komenda", color: COLORS.warn }]);
    }

    // -------------------------------------------------------------
    // 3. OBSŁUGA PRZYCISKÓW (type: 3 - MESSAGE_COMPONENT)
    // -------------------------------------------------------------
    if (body.type === 3) {
      const customId = body.data?.custom_id || "";

      if (customId === "btn_action_panel") {
        return await buildPanelResponse();
      }

      if (customId === "btn_action_raport") {
        return await buildReportMenuResponse();
      }

      if (customId === "btn_action_defect") {
        return openDefectModal();
      }

      if (customId === "btn_action_request") {
        return openRequestModal();
      }

      if (customId === "btn_action_grafik") {
        const from = todayUtcMidnight();
        const to = new Date(from.getTime() + 7 * 24 * 3600 * 1000);
        const duties = await dutiesBetween(user.id, from, to);
        return reply(
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
      }

      if (customId === "btn_action_status") {
        const [missed, pending] = await Promise.all([
          prisma.duty.count({ where: { userId: user.id, status: "MISSED" } }),
          prisma.driverRequest.count({ where: { userId: user.id, status: "PENDING" } }),
        ]);
        return reply(
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
      }

      // Kliknięcie "Raport: ..." dla konkretnej służby -> otwórz MODAL
      if (customId.startsWith("btn_report_")) {
        const dutyId = customId.replace("btn_report_", "");
        const duty = await prisma.duty.findUnique({
          where: { id: dutyId },
          include: { line: true, vehicle: true, replacementVehicle: true, report: true },
        });

        if (!duty || duty.userId !== user.id) {
          return reply([
            {
              title: "Służba nie znaleziona",
              color: COLORS.bad,
              description: "Nie znaleziono wybranej służby lub nie należy ona do Twojego konta.",
            },
          ]);
        }

        if (duty.report) {
          return reply([
            {
              title: "Raport już złożony",
              color: COLORS.warn,
              description: `Dla służby z dnia **${fmtDate(duty.date)}** raport został już wcześniej złożony.`,
            },
          ]);
        }

        const veh = duty.replacementVehicle || duty.vehicle;
        const initialMileage = String(veh?.mileage ?? 0);

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

      return reply([{ title: "Nieznana akcja", color: COLORS.warn }]);
    }

    // -------------------------------------------------------------
    // 4. OBSŁUGA ZATWIERDZENIA MODALU (type: 5 - MODAL_SUBMIT)
    // -------------------------------------------------------------
    if (body.type === 5) {
      const customId = body.data?.custom_id || "";
      const values = getModalValues(body);

      // A. ZATWIERDZENIE RAPORTU ZE SŁUŻBY
      if (customId.startsWith("modal_report_")) {
        const dutyId = customId.replace("modal_report_", "");
        const duty = await prisma.duty.findUnique({
          where: { id: dutyId },
          include: { line: true, vehicle: true, replacementVehicle: true, report: true },
        });

        if (!duty || duty.userId !== user.id) {
          return reply([
            {
              title: "Służba nie znaleziona",
              color: COLORS.bad,
              description: "Nie znaleziono służby lub brak uprawnień.",
            },
          ]);
        }

        if (duty.report) {
          return reply([
            {
              title: "Raport już istnieje",
              color: COLORS.warn,
              description: `Raport dla tej służby został już zarejestrowany w systemie.`,
            },
          ]);
        }

        const startMileage = parseInt(values.start_mileage || "0", 10);
        const endMileage = parseInt(values.end_mileage || "0", 10);
        const startScreenshot = values.start_screenshot || "Discord link";
        const endScreenshot = values.end_screenshot || "Discord link";
        const summaryFile = values.summary_file || "Raport złożony przez bota Discord";

        if (isNaN(startMileage) || isNaN(endMileage) || endMileage < startMileage) {
          return reply([
            {
              title: "Nieprawidłowy przebieg",
              color: COLORS.bad,
              description: `Stan końcowy licznika (${endMileage} km) nie może być mniejszy niż początkowy (${startMileage} km). Złóż raport ponownie z poprawnymi danymi.`,
            },
          ]);
        }

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
          ...(veh && endMileage > veh.mileage
            ? [
                prisma.vehicle.update({
                  where: { id: veh.id },
                  data: { mileage: endMileage },
                }),
              ]
            : []),
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

        return reply(
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
      }

      // B. ZATWIERDZENIE ZGŁOSZENIA USTERKI
      if (customId === "modal_defect") {
        const fleetNum = values.fleet_number?.trim();
        const title = values.title?.trim();
        const description = values.description?.trim();
        const photoUrl = values.photo_url?.trim();

        if (!fleetNum || !title || !description) {
          return reply([
            {
              title: "Brak wymaganych pól",
              color: COLORS.bad,
              description: "Wypełnij numer taborowy, tytuł usterki oraz opis awarii.",
            },
          ]);
        }

        const vehicle = await prisma.vehicle.findFirst({
          where: { fleetNumber: fleetNum },
        });

        if (!vehicle) {
          return reply([
            {
              title: "Nie znaleziono pojazdu",
              color: COLORS.bad,
              description: `W bazie taboru VZTM Kielce nie ma pojazdu o numerze taborowym **#${fleetNum}**.\nSprawdź poprawny numer za pomocą komendy \`/tabor\` i spróbuj ponownie.`,
            },
          ]);
        }

        const photoList = photoUrl ? [photoUrl] : ["brak"];
        await prisma.vehicleDefect.create({
          data: {
            userId: user.id,
            vehicleId: vehicle.id,
            title: title.slice(0, 100),
            description: description.slice(0, 1000),
            photos: JSON.stringify(photoList),
            status: "NOWE",
          },
        });

        await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { status: "WARSZTAT" },
        });

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
                  value: photoUrl && photoUrl.startsWith("http") ? `[Zobacz zdjęcie](${photoUrl})` : "Brak zdjęcia",
                  inline: true,
                },
              ],
              url: `${site}/tabor`,
            },
          ])
        );

        return reply(
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
      }

      // C. ZATWIERDZENIE WNIOSKU KIEROWCY
      if (customId === "modal_request") {
        const rawType = (values.type || "").toUpperCase().trim();
        const reason = values.reason?.trim();
        const details = values.details?.trim();

        if (!reason) {
          return reply([
            {
              title: "Brak uzasadnienia",
              color: COLORS.bad,
              description: "Uzasadnienie wniosku jest wymagane.",
            },
          ]);
        }

        let requestType = "INNE";
        if (rawType.includes("URLOP")) requestType = "URLOP";
        else if (rawType.includes("DODATKOW")) requestType = "DODATKOWA_SLUZBA";
        else if (rawType.includes("ETAT")) requestType = "ZMIANA_ETATU";
        else if (rawType.includes("ANULOW")) requestType = "ANULOWANIE_SLUZBY";
        else if (rawType.includes("ODWIESZ")) requestType = "ODWIESZENIE";
        else if (rawType.includes("POJAZD")) requestType = "STALY_POJAZD";

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

        return reply(
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
      }

      return reply([{ title: "Nieznany formularz", color: COLORS.warn }]);
    }

    return reply([{ title: "Nieznana interakcja", color: COLORS.warn }]);
  } catch (err) {
    console.error("[discord] interaction error", (err as Error)?.message);
    return reply([
      {
        title: "Błąd bota",
        color: COLORS.bad,
        description: "Wystąpił nieoczekiwany błąd podczas przetwarzania żądania. Spróbuj ponownie za chwilę.",
      },
    ]);
  }
}
