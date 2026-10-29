import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";
import { getDayOrder } from "@/lib/brigades";
import { COLORS, notifyUser, runAfter } from "@/lib/discord";

function getWarsawDayBounds(date: Date): { startOfDay: Date; endOfDay: Date; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZoneName: "shortOffset",
  }).formatToParts(date);

  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[partMap.weekday] ?? date.getDay();

  const tzName = partMap.timeZoneName || "GMT+1";
  const offsetMatch = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
  let offsetHours = 1;
  let offsetMins = 0;
  if (offsetMatch) {
    offsetHours = parseInt(offsetMatch[1], 10);
    offsetMins = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;
  }
  const totalOffsetMs = (offsetHours * 60 + (offsetHours < 0 ? -offsetMins : offsetMins)) * 60 * 1000;

  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - totalOffsetMs);
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - totalOffsetMs);

  return { startOfDay, endOfDay, dayOfWeek };
}

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageDuties(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania służbami" }, { status: 403 });
  }

  const formData = await req.formData();
  const rawUserId = formData.get("userId");
  const userId = typeof rawUserId === "string" ? rawUserId.trim() : "";
  const rawLineId = formData.get("lineId");
  const lineId = typeof rawLineId === "string" ? rawLineId.trim() : "";
  const rawVehicleId = formData.get("vehicleId");
  const vehicleId = typeof rawVehicleId === "string" ? rawVehicleId.trim() : "";
  const rawDateStr = formData.get("date");
  const dateStr = typeof rawDateStr === "string" ? rawDateStr.trim() : "";
  const rawBrigade = formData.get("brigade");
  const brigade = typeof rawBrigade === "string" ? rawBrigade.trim() : "";
  const rawShift = formData.get("shift");
  const shift = typeof rawShift === "string" ? rawShift.trim() : "";
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  const rawRequestId = formData.get("requestId");
  const requestId = typeof rawRequestId === "string" ? rawRequestId.trim() : "";

  // Pojazd z taboru jest obowiązkowy
  if (!vehicleId) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_vehicle");
    return NextResponse.redirect(url, 303);
  }

  if (!userId || !lineId || !dateStr) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_fields");
    return NextResponse.redirect(url, 303);
  }

  const dutyDate = new Date(dateStr);
  if (isNaN(dutyDate.getTime())) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "invalid_date");
    return NextResponse.redirect(url, 303);
  }

  const { startOfDay, endOfDay, dayOfWeek } = getWarsawDayBounds(dutyDate);

  const [driverUser, vehicleObj, lineObj] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    prisma.line.findUnique({ where: { id: lineId } }),
  ]);

  if (!driverUser) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "user_not_found");
    return NextResponse.redirect(url, 303);
  }

  if (!vehicleObj) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "vehicle_not_found");
    return NextResponse.redirect(url, 303);
  }

  if (vehicleObj.status !== "SPRAWNY") {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "vehicle_not_available");
    return NextResponse.redirect(url, 303);
  }

  // Sprawdzenie duplikatu służby dla kierowcy lub pojazdu tego samego dnia
  const [driverConflict, vehicleConflict] = await Promise.all([
    prisma.duty.findFirst({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    prisma.duty.findFirst({
      where: {
        vehicleId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
  ]);

  if (driverConflict) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "driver_duty_duplicate");
    return NextResponse.redirect(url, 303);
  }

  if (vehicleConflict) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "vehicle_duty_duplicate");
    return NextResponse.redirect(url, 303);
  }

  // 1. Sprawdzenie czy kierowca ma zaakceptowany urlop w tym terminie
  const vacationConflict = await prisma.driverRequest.findFirst({
    where: {
      userId,
      type: "URLOP",
      status: "ACCEPTED",
      dateStart: { lte: endOfDay },
      dateEnd: { gte: startOfDay },
    },
    include: { user: true },
  });

  if (vacationConflict) {
    const driverName = vacationConflict.user.username;
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "urlop_conflict");
    url.searchParams.set("driver", driverName);
    return NextResponse.redirect(url, 303);
  }

  // 2. Walidacja zgodności przewoźnika dla pojazdu
  if (vehicleObj && driverUser.carrier && vehicleObj.carrier !== driverUser.carrier) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "carrier_vehicle_mismatch");
    url.searchParams.set("userCarrier", driverUser.carrier);
    url.searchParams.set("vehCarrier", vehicleObj.carrier);
    return NextResponse.redirect(url, 303);
  }

  // 3. Walidacja zgodności przewoźnika dla linii
  if (lineObj && lineObj.carrier && driverUser.carrier && lineObj.carrier !== driverUser.carrier) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "carrier_line_mismatch");
    url.searchParams.set("userCarrier", driverUser.carrier);
    url.searchParams.set("lineCarrier", lineObj.carrier);
    return NextResponse.redirect(url, 303);
  }

  // 4. Walidacja dnia tygodnia dla brygady
  if (brigade) {
    const dayOrder = getDayOrder(brigade);
    if (dayOrder === 2 && dayOfWeek !== 6) {
      // Sobota
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "brigade_day_mismatch");
      url.searchParams.set("expected", "sobota");
      return NextResponse.redirect(url, 303);
    } else if (dayOrder === 3 && dayOfWeek !== 0) {
      // Niedziela
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "brigade_day_mismatch");
      url.searchParams.set("expected", "niedziela");
      return NextResponse.redirect(url, 303);
    } else if (dayOrder === 1 && (dayOfWeek === 0 || dayOfWeek === 6)) {
      // Dni robocze
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "brigade_day_mismatch");
      url.searchParams.set("expected", "roboczy");
      return NextResponse.redirect(url, 303);
    }
  }

  let finalBrigade = brigade ? brigade.trim() : "";
  if (finalBrigade && shift) {
    if (!finalBrigade.includes("Zmiana")) {
      finalBrigade = `${finalBrigade}/${shift}`;
    }
  }

  const isExtra = formData.get("isExtra") === "true" || Boolean(requestId);

  await prisma.duty.create({
    data: {
      userId,
      lineId,
      vehicleId: vehicleId || null,
      date: dutyDate,
      brigade: finalBrigade || null,
      shift: shift || null,
      notes: notes || null,
      isExtra,
    },
  });

  // Automatyczne oznaczenie wniosku o dodatkową służbę jako Zaakceptowany
  if (requestId) {
    await prisma.driverRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: {
        status: "ACCEPTED",
        responseNotes: "Służba została pomyślnie utworzona i przydzielona w grafiku.",
      },
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  await runAfter(async () => {
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    await notifyUser(userId, [
      {
        title: isExtra ? "Nowa służba dodatkowa w grafiku" : "Nowa służba w grafiku",
        color: COLORS.info,
        fields: [
          { name: "Data", value: dutyDate.toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" }), inline: true },
          { name: "Linia", value: lineObj?.number || "-", inline: true },
          { name: "Brygada", value: finalBrigade || "-", inline: true },
          { name: "Pojazd", value: veh ? `#${veh.fleetNumber} ${veh.model}` : "-", inline: true },
          ...(notes ? [{ name: "Uwagi", value: notes }] : []),
        ],
      },
    ]);
  });

  redirect("/panel/zarzad");
}
