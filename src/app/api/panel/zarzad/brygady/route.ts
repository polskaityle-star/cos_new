import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageLines } from "@/lib/roles";

const ALLOWED_CARRIERS = ["VMPK", "VBP"];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(val: string | null | undefined): boolean {
  if (!val) return true;
  return TIME_REGEX.test(val);
}

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageLines(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania brygadami" }, { status: 403 });
  }

  const formData = await req.formData();
  const rawLineId = formData.get("lineId");
  const lineId = typeof rawLineId === "string" ? rawLineId.trim() : "";
  const rawCarrier = formData.get("carrier");
  const carrier = typeof rawCarrier === "string" ? rawCarrier.trim() : "";
  const rawBrigadeNumber = formData.get("brigadeNumber");
  const brigadeNumber = typeof rawBrigadeNumber === "string" ? rawBrigadeNumber.trim() : "";
  const rawBrigadeType = formData.get("brigadeType");
  const brigadeType = typeof rawBrigadeType === "string" ? rawBrigadeType.trim() : "NORMALNA";

  const rawStartTime = formData.get("startTime");
  const startTime = typeof rawStartTime === "string" ? rawStartTime.trim() : "";
  const rawEndTime = formData.get("endTime");
  const endTime = typeof rawEndTime === "string" ? rawEndTime.trim() : "";
  const rawFirstStopDeparture = formData.get("firstStopDeparture");
  const firstStopDeparture = typeof rawFirstStopDeparture === "string" ? rawFirstStopDeparture.trim() : null;
  const rawLastStopArrival = formData.get("lastStopArrival");
  const lastStopArrival = typeof rawLastStopArrival === "string" ? rawLastStopArrival.trim() : null;
  const rawStartLocation = formData.get("startLocation");
  const startLocation = typeof rawStartLocation === "string" ? rawStartLocation.trim() : "";
  const rawEndLocation = formData.get("endLocation");
  const endLocation = typeof rawEndLocation === "string" ? rawEndLocation.trim() : "";

  // Pola dla brygady szczytowej (II wyjazd i zjazd)
  const rawStartTime2 = formData.get("startTime2");
  const startTime2 = typeof rawStartTime2 === "string" ? rawStartTime2.trim() : "";
  const rawEndTime2 = formData.get("endTime2");
  const endTime2 = typeof rawEndTime2 === "string" ? rawEndTime2.trim() : "";
  const rawFirstStopDeparture2 = formData.get("firstStopDeparture2");
  const firstStopDeparture2 = typeof rawFirstStopDeparture2 === "string" ? rawFirstStopDeparture2.trim() : null;
  const rawLastStopArrival2 = formData.get("lastStopArrival2");
  const lastStopArrival2 = typeof rawLastStopArrival2 === "string" ? rawLastStopArrival2.trim() : null;
  const rawStartLocation2 = formData.get("startLocation2");
  const startLocation2 = typeof rawStartLocation2 === "string" ? rawStartLocation2.trim() : "";
  const rawEndLocation2 = formData.get("endLocation2");
  const endLocation2 = typeof rawEndLocation2 === "string" ? rawEndLocation2.trim() : "";

  const rawDriverChanges = formData.get("driverChanges");
  const driverChanges = typeof rawDriverChanges === "string" ? rawDriverChanges.trim() : null;
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : null;

  if (!lineId) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_line");
    return NextResponse.redirect(url, 303);
  }

  const line = await prisma.line.findUnique({
    where: { id: lineId },
  });
  if (!line) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "line_not_found");
    return NextResponse.redirect(url, 303);
  }

  if (!brigadeNumber) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "missing_brigade_number");
    return NextResponse.redirect(url, 303);
  }

  let finalCarrier: string | null = null;
  if (carrier) {
    if (!ALLOWED_CARRIERS.includes(carrier)) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "invalid_carrier");
      return NextResponse.redirect(url, 303);
    }
    finalCarrier = carrier;
  }

  // Walidacja formatu godzin ^([01]\d|2[0-3]):[0-5]\d$ (lub pusty)
  if (
    !isValidTime(startTime) ||
    !isValidTime(endTime) ||
    !isValidTime(firstStopDeparture) ||
    !isValidTime(lastStopArrival) ||
    !isValidTime(startTime2) ||
    !isValidTime(endTime2) ||
    !isValidTime(firstStopDeparture2) ||
    !isValidTime(lastStopArrival2)
  ) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "invalid_time_format");
    return NextResponse.redirect(url, 303);
  }

  // Sprawdzenie duplikatu (lineId + brigadeNumber)
  const existingBrigade = await prisma.brigadeSchedule.findFirst({
    where: {
      lineId,
      brigadeNumber,
    },
  });
  if (existingBrigade) {
    const url = new URL("/panel/zarzad", req.url);
    url.searchParams.set("error", "brigade_exists");
    return NextResponse.redirect(url, 303);
  }

  try {
    await prisma.brigadeSchedule.create({
      data: {
        lineId,
        carrier: finalCarrier,
        brigadeType: brigadeType || "NORMALNA",
        brigadeNumber,
        startTime: startTime || "",
        endTime: endTime || "",
        firstStopDeparture,
        lastStopArrival,
        startLocation: startLocation || "",
        endLocation: endLocation || "",
        startTime2: startTime2 || "",
        endTime2: endTime2 || "",
        firstStopDeparture2,
        lastStopArrival2,
        startLocation2: startLocation2 || "",
        endLocation2: endLocation2 || "",
        driverChanges: driverChanges || null,
        notes: notes || null,
      },
    });

    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const url = new URL("/panel/zarzad", req.url);
      url.searchParams.set("error", "brigade_exists");
      return NextResponse.redirect(url, 303);
    }
    throw err;
  }

  redirect("/panel/zarzad");
}
