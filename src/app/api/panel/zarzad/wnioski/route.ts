import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role, (session.user as any)?.username)) {
    return NextResponse.json({ message: "Brak autoryzacji do zarządzania wnioskami" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const action = searchParams.get("action");

  // Czyszczenie historii wniosków (Wymóg 12)
  if (action === "clear_history") {
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

  const formData = await req.formData().catch(() => null);
  const rejectReason = (formData?.get("rejectReason") as string) || (searchParams.get("reason") as string) || "";

  if (action === "accept") {
    await prisma.driverRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    });

    // 1. Jeśli to wniosek o stały pojazd lub zmianę stałego pojazdu, przypisujemy pojazd kierowcy
    if ((driverReq.type === "STALY_POJAZD" || driverReq.type === "ZMIANA_STALEGO_POJAZDU") && driverReq.details) {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { assignedVehicleId: driverReq.details },
      });
    }

    // 1.1 Jeśli to wniosek o usunięcie stałego pojazdu (rezygnacja), czyścimy przypisany pojazd
    if (driverReq.type === "USUNIECIE_STALEGO_POJAZDU") {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { assignedVehicleId: null },
      });
    }

    // 2. Jeśli to wniosek o zmianę etatu, aktualizujemy dni pracy (Wymóg 6)
    if (driverReq.type === "ZMIANA_ETATU" && driverReq.details) {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { workingDays: driverReq.details },
      });
    }

    // 2.1 Jeśli to wniosek o odwieszenie konta, odblokowujemy kierowcę
    if (driverReq.type === "ODWIESZENIE") {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { suspended: false },
      });
    }

    // 3. Jeśli to było anulowanie służby i podano ID służby, usuwamy służbę z grafiku (Wymóg 15)
    if (driverReq.type === "ANULOWANIE_SLUZBY" && driverReq.dutyId) {
      try {
        await prisma.duty.delete({
          where: { id: driverReq.dutyId },
        });
      } catch (e) {
        console.error("Could not delete duty during cancellation acceptance", e);
      }
    }
  } else if (action === "reject") {
    await prisma.driverRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        responseNotes: rejectReason || "Wniosek odrzucony przez Zarząd",
      },
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
