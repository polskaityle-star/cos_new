import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageLines } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageLines(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;
  const lineId = formData.get("lineId") as string;
  const brigadeNumber = formData.get("brigadeNumber") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const firstStopDeparture = (formData.get("firstStopDeparture") as string) || null;
  const lastStopArrival = (formData.get("lastStopArrival") as string) || null;
  const startLocation = formData.get("startLocation") as string;
  const endLocation = formData.get("endLocation") as string;
  const driverChanges = formData.get("driverChanges") as string;
  const notes = formData.get("notes") as string;

  if (id && lineId && brigadeNumber && startTime && endTime && startLocation && endLocation) {
    await prisma.brigadeSchedule.update({
      where: { id },
      data: {
        lineId,
        brigadeNumber,
        startTime,
        endTime,
        firstStopDeparture,
        lastStopArrival,
        startLocation,
        endLocation,
        driverChanges: driverChanges || null,
        notes: notes || null,
      }
    });

    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
  }

  redirect("/panel/zarzad");
}
