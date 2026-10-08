import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role)) {
    return NextResponse.json({ message: "Brak autoryzacji do zarządzania wnioskami" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const action = searchParams.get("action");

  if (!requestId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  const driverReq = await prisma.driverRequest.findUnique({
    where: { id: requestId }
  });

  if (!driverReq) {
    return NextResponse.json({ message: "Wniosek nie istnieje" }, { status: 404 });
  }

  if (action === "accept") {
    await prisma.driverRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" }
    });

    // 1. Jeśli to wniosek o stały pojazd, przypisujemy pojazd kierowcy (Wymóg 4)
    if (driverReq.type === "STALY_POJAZD" && driverReq.details) {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { assignedVehicleId: driverReq.details },
      });
    }

    // 2. Jeśli to wniosek o zmianę etatu, aktualizujemy dni pracy (Wymóg 6)
    if (driverReq.type === "ZMIANA_ETATU" && driverReq.details) {
      await prisma.user.update({
        where: { id: driverReq.userId },
        data: { workingDays: driverReq.details },
      });
    }

    // 3. Jeśli to było anulowanie służby i podano ID służby, usuwamy służbę z grafiku (Wymóg 15)
    if (driverReq.type === "ANULOWANIE_SLUZBY" && driverReq.dutyId) {
      try {
        await prisma.duty.delete({
          where: { id: driverReq.dutyId }
        });
      } catch (e) {
        console.error("Could not delete duty during cancellation acceptance", e);
      }
    }
  } else if (action === "reject") {
    await prisma.driverRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" }
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}

