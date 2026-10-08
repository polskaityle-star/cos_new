import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";

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

  if (userId && lineId && dateStr) {
    const dutyDate = new Date(dateStr);
    const startOfDay = new Date(dutyDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dutyDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Sprawdzenie czy kierowca ma zaakceptowany urlop w tym terminie (Wymóg 16)
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

    await prisma.duty.create({
      data: {
        userId,
        lineId,
        vehicleId: vehicleId || null,
        date: dutyDate,
        brigade: brigade || null,
      },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
  }

  redirect("/panel/zarzad");
}

