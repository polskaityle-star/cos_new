import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageFleet } from "@/lib/roles";
import { warsawTodayStr } from "@/lib/dates";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageFleet(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!vehicle) {
      return NextResponse.json({ message: "Nie znaleziono pojazdu" }, { status: 404 });
    }

    const today = warsawTodayStr();

    const [activeDefects, assignedUsers, scheduledDuties] = await Promise.all([
      prisma.vehicleDefect.count({
        where: { vehicleId: id, status: { in: ["NOWE", "WARSZTAT"] } },
      }),
      prisma.user.count({
        where: { assignedVehicleId: id },
      }),
      prisma.duty.findMany({
        where: {
          status: "SCHEDULED",
          OR: [{ vehicleId: id }, { replacementVehicleId: id }],
        },
        select: { date: true },
      }),
    ]);

    if (vehicle.status !== "KASACJA" && activeDefects > 0) {
      return NextResponse.json(
        { message: "Pojazd ma aktywne usterki (NOWE lub WARSZTAT), nie można go usunąć" },
        { status: 409 }
      );
    }

    if (assignedUsers > 0) {
      return NextResponse.json(
        { message: "Pojazd jest przypisany do użytkownika, nie można go usunąć" },
        { status: 409 }
      );
    }

    const hasUpcomingDuty = scheduledDuties.some(
      (duty: { date: Date }) => duty.date.toISOString().slice(0, 10) >= today
    );

    if (hasUpcomingDuty) {
      return NextResponse.json(
        { message: "Pojazd ma zaplanowane służby, nie można go usunąć" },
        { status: 409 }
      );
    }

    await prisma.vehicle.delete({
      where: { id }
    });
    revalidatePath("/tabor");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
