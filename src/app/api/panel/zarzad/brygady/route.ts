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
    return NextResponse.json({ message: "Brak uprawnień do zarządzania brygadami" }, { status: 403 });
  }

  const formData = await req.formData();
  const lineId = formData.get("lineId") as string;
  const carrier = (formData.get("carrier") as string) || null;
  const brigadeNumber = formData.get("brigadeNumber") as string;
  const brigadeType = (formData.get("brigadeType") as string) || "NORMALNA";
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const firstStopDeparture = (formData.get("firstStopDeparture") as string) || null;
  const lastStopArrival = (formData.get("lastStopArrival") as string) || null;
  const startLocation = formData.get("startLocation") as string;
  const endLocation = formData.get("endLocation") as string;

  // Pola dla brygady szczytowej (II wyjazd i zjazd)
  const startTime2 = formData.get("startTime2") as string;
  const endTime2 = formData.get("endTime2") as string;
  const firstStopDeparture2 = (formData.get("firstStopDeparture2") as string) || null;
  const lastStopArrival2 = (formData.get("lastStopArrival2") as string) || null;
  const startLocation2 = formData.get("startLocation2") as string;
  const endLocation2 = formData.get("endLocation2") as string;

  const driverChanges = formData.get("driverChanges") as string;
  const notes = formData.get("notes") as string;

  if (lineId && brigadeNumber) {
    await prisma.brigadeSchedule.create({
      data: {
        lineId,
        carrier: carrier || null,
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
      }
    });

    revalidatePath("/brygady");
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
  }

  redirect("/panel/zarzad");
}
