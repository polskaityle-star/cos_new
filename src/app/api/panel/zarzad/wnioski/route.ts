import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests, isUserAdminOrOwner } from "@/lib/roles";
import { COLORS, notifyUser, runAfter } from "@/lib/discord";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak autoryzacji do zarządzania wnioskami" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const action = searchParams.get("action");

  // Czyszczenie historii wniosków (tylko dla admina/właściciela)
  if (action === "clear_history") {
    if (!isUserAdminOrOwner(session.user.role, session.user.username)) {
      return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
    }
    await prisma.driverRequest.deleteMany({
      where: { status: { in: ["ACCEPTED", "REJECTED"] } },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    redirect("/panel/zarzad");
    return;
  }

  // Usuwanie pojedynczego wniosku (np. usunięcie urlopu przez Zarząd)
  if (action === "delete" && requestId) {
    const existing = await prisma.driverRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Wniosek nie istnieje" }, { status: 404 });
    }
    await prisma.driverRequest.delete({
      where: { id: requestId },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    redirect("/panel/zarzad");
    return;
  }

  if (!requestId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  const driverReq = await prisma.driverRequest.findUnique({
    where: { id: requestId },
  });

  if (!driverReq) {
    return NextResponse.json({ message: "Wniosek nie istnieje" }, { status: 404 });
  }

  if (action === "accept" || action === "reject") {
    if (driverReq.status !== "PENDING") {
      return NextResponse.json({ message: "Wniosek został już rozpatrzony" }, { status: 409 });
    }
  }

  const formData = await req.formData().catch(() => null);
  const rawRejectReason = formData?.get("rejectReason");
  const rejectReason =
    (typeof rawRejectReason === "string" ? rawRejectReason : null) || searchParams.get("reason") || "";

  if (action === "accept") {
    // Sprawdzenie dla stałego pojazdu / zmiany stałego pojazdu
    if (driverReq.type === "STALY_POJAZD" || driverReq.type === "ZMIANA_STALEGO_POJAZDU") {
      if (!driverReq.details) {
        return NextResponse.json({ message: "Brak wskazanego pojazdu" }, { status: 400 });
      }
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: driverReq.details },
      });
      if (!vehicle) {
        return NextResponse.json({ message: "Pojazd nie istnieje" }, { status: 404 });
      }
      if (vehicle.status !== "SPRAWNY") {
        return NextResponse.json({ message: "Pojazd nie ma statusu SPRAWNY" }, { status: 400 });
      }
      const driver = await prisma.user.findUnique({
        where: { id: driverReq.userId },
        select: { carrier: true },
      });
      if (driver?.carrier && vehicle.carrier && vehicle.carrier !== driver.carrier) {
        return NextResponse.json({ message: "Pojazd nie pasuje do przewoźnika kierowcy" }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      // 1. Jeśli to wniosek o stały pojazd lub zmianę stałego pojazdu, przypisujemy pojazd kierowcy
      if ((driverReq.type === "STALY_POJAZD" || driverReq.type === "ZMIANA_STALEGO_POJAZDU") && driverReq.details) {
        await tx.user.update({
          where: { id: driverReq.userId },
          data: { assignedVehicleId: driverReq.details },
        });
      }

      // 1.1 Jeśli to wniosek o usunięcie stałego pojazdu (rezygnacja), czyścimy przypisany pojazd
      if (driverReq.type === "USUNIECIE_STALEGO_POJAZDU") {
        await tx.user.update({
          where: { id: driverReq.userId },
          data: { assignedVehicleId: null },
        });
      }

      // 2. Jeśli to wniosek o zmianę etatu, aktualizujemy dni pracy
      if (driverReq.type === "ZMIANA_ETATU" && driverReq.details) {
        await tx.user.update({
          where: { id: driverReq.userId },
          data: { workingDays: driverReq.details },
        });
      }

      // 2.1 Jeśli to wniosek o odwieszenie konta, odblokowujemy kierowcę
      if (driverReq.type === "ODWIESZENIE") {
        await tx.user.update({
          where: { id: driverReq.userId },
          data: { suspended: false },
        });
      }

      // 3. Jeśli to było anulowanie służby i podano ID służby, usuwamy służbę z grafiku
      if (driverReq.type === "ANULOWANIE_SLUZBY" && driverReq.dutyId) {
        await tx.duty.deleteMany({
          where: { id: driverReq.dutyId },
        });
      }
    });
  } else if (action === "reject") {
    await prisma.$transaction(async (tx) => {
      await tx.driverRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          responseNotes: rejectReason || "Wniosek odrzucony przez Zarząd",
        },
      });
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  if (action === "accept" || action === "reject") {
    const accepted = action === "accept";
    await runAfter(() =>
      notifyUser(driverReq.userId, [
        {
          title: accepted ? `Wniosek zaakceptowany: ${driverReq.type}` : `Wniosek odrzucony: ${driverReq.type}`,
          color: accepted ? COLORS.ok : COLORS.bad,
          description: accepted ? driverReq.reason || undefined : rejectReason || "Wniosek odrzucony przez Zarząd",
        },
      ])
    );
  }

  redirect("/panel/zarzad");
}
