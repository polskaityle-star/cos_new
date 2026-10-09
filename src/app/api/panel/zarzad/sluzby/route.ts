import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";
import { getDayOrder } from "@/lib/brigades";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || !canManageDuties(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania służbami" }, { status: 403 });
  }

  const formData = await req.formData();
  const userId = formData.get("userId") as string;
  const lineId = formData.get("lineId") as string;
  const vehicleId = formData.get("vehicleId") as string;
  const dateStr = formData.get("date") as string;
  const brigade = formData.get("brigade") as string;
  const shift = formData.get("shift") as string;
  const notes = formData.get("notes") as string;
  const requestId = formData.get("requestId") as string;

  // Wymóg 7: Pojazd z taboru jest obowiązkowy
  if (!vehicleId) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_vehicle");
    return NextResponse.redirect(url, 303);
  }

  if (userId && lineId && dateStr) {
    const dutyDate = new Date(dateStr);
    const startOfDay = new Date(dutyDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dutyDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [driverUser, lineObj] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.line.findUnique({ where: { id: lineId } }),
    ]);

    // 1. Sprawdzenie czy kierowca ma zaakceptowany urlop w tym terminie (Wymóg 16)
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

    // 2. Walidacja zgodności przewoźnika dla pojazdu (Punkt 10)
    if (vehicleId) {
      const vehicleObj = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (vehicleObj && driverUser?.carrier && vehicleObj.carrier !== driverUser.carrier) {
        const url = new URL("/panel/zarzad", req.url);
        url.searchParams.set("error", "carrier_vehicle_mismatch");
        url.searchParams.set("userCarrier", driverUser.carrier);
        url.searchParams.set("vehCarrier", vehicleObj.carrier);
        return NextResponse.redirect(url, 303);
      }
    }

    // 3. Walidacja zgodności przewoźnika dla linii (Punkt 10)
    if (lineObj && lineObj.carrier && driverUser?.carrier && lineObj.carrier !== driverUser.carrier) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "carrier_line_mismatch");
      url.searchParams.set("userCarrier", driverUser.carrier);
      url.searchParams.set("lineCarrier", lineObj.carrier);
      return NextResponse.redirect(url, 303);
    }

    // 4. Walidacja dnia tygodnia dla brygady (Punkt 9: brygada sobotnia tylko w sobotę, itp.)
    if (brigade) {
      const dayOrder = getDayOrder(brigade);
      // getDay: 0 = niedziela, 1 = pon, ..., 6 = sobota
      const dayOfWeek = dutyDate.getDay();

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

    // Wymóg 3: Automatyczne oznaczenie wniosku o dodatkową służbę jako Zaakceptowany
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
  }

  redirect("/panel/zarzad");
}

