import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";
import { getDayOrder, isBrigadeAllowedOnWeekday } from "@/lib/brigades";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageDuties(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const getText = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : null;
  };
  const dutyId = getText("dutyId");
  if (!dutyId) return NextResponse.json({ message: "Brak ID służby" }, { status: 400 });

  const existing = await prisma.duty.findUnique({ where: { id: dutyId }, include: { report: true } });
  if (!existing) return NextResponse.json({ message: "Służba nie istnieje" }, { status: 404 });

  const userId = getText("userId") || existing.userId;
  const lineId = getText("lineId") || existing.lineId;
  const vehicleField = getText("vehicleId");
  const vehicleId = vehicleField === null ? existing.vehicleId : vehicleField || null;
  const dateStr = getText("date") || existing.date.toISOString().slice(0, 10);
  const brigade = getText("brigade") ?? existing.brigade ?? "";
  const shift = getText("shift") ?? existing.shift ?? "";
  const notes = getText("notes") ?? existing.notes ?? "";
  const status = getText("status") || existing.status;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ message: "Nieprawidłowa data służby." }, { status: 400 });
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr || !["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"].includes(status)) {
    return NextResponse.json({ message: "Nieprawidłowa data lub status służby." }, { status: 400 });
  }
  const scheduleChanged = userId !== existing.userId || lineId !== existing.lineId || vehicleId !== existing.vehicleId || dateStr !== existing.date.toISOString().slice(0, 10) || brigade !== (existing.brigade || "");
  if (existing.report && (scheduleChanged || status !== existing.status)) {
    return NextResponse.json({ message: "Nie można zmieniać danych ani statusu służby z raportem." }, { status: 409 });
  }
  if (scheduleChanged || (status === "SCHEDULED" && existing.status !== "SCHEDULED")) {
    if (!vehicleId) return NextResponse.json({ message: "Pojazd jest wymagany." }, { status: 400 });
    const [driver, line, vehicle] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.line.findUnique({ where: { id: lineId } }),
      prisma.vehicle.findUnique({ where: { id: vehicleId } }),
    ]);
    if (!driver || !line || !vehicle) return NextResponse.json({ message: "Kierowca, linia lub pojazd nie istnieje." }, { status: 404 });
    if (vehicle.status !== "SPRAWNY") return NextResponse.json({ message: "Pojazd nie jest sprawny." }, { status: 400 });
    if (driver.carrier && (vehicle.carrier !== driver.carrier || (line.carrier && line.carrier !== driver.carrier))) {
      return NextResponse.json({ message: "Przewoźnik kierowcy, pojazdu i linii musi być zgodny." }, { status: 400 });
    }
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const [conflict, vacation] = await Promise.all([
      prisma.duty.findFirst({ where: { id: { not: dutyId }, date: { gte: date, lt: nextDay }, OR: [{ userId }, { vehicleId }] } }),
      prisma.driverRequest.findFirst({ where: { userId, type: "URLOP", status: "ACCEPTED", dateStart: { lt: nextDay }, dateEnd: { gte: date } } }),
    ]);
    if (conflict) return NextResponse.json({ message: "Kierowca lub pojazd ma już służbę tego dnia." }, { status: 409 });
    if (vacation) return NextResponse.json({ message: "Kierowca ma zaakceptowany urlop w tym terminie." }, { status: 409 });
    const order = getDayOrder(brigade);
    const weekday = date.getUTCDay();
    // Order 3 ("Niedziela i Święta") nie jest ograniczany do niedzieli, bo święta mogą wypadać w dowolny dzień tygodnia
    if (!isBrigadeAllowedOnWeekday(order, weekday)) {
      return NextResponse.json({ message: "Brygada nie pasuje do dnia tygodnia." }, { status: 400 });
    }
  }

  await prisma.duty.update({
    where: { id: dutyId },
    data: { userId, lineId, vehicleId, date, brigade: brigade || null, shift: shift || null, notes: notes || null, status },
  });

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
