import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.user.role !== "ZARZAD") {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const defectId = searchParams.get("defectId");
  const actionParam = searchParams.get("newStatus");

  const formData = await req.formData().catch(() => null);
  const formStatus = formData?.get("status") as string;
  const newStatus = actionParam || formStatus;

  if (!defectId || !newStatus) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  const defectType = formData?.get("defectType") as string;
  const workshopStartStr = formData?.get("workshopStart") as string;
  const workshopEndStr = formData?.get("workshopEnd") as string;
  const adminNotes = formData?.get("adminNotes") as string;

  const updateData: any = {
    status: newStatus,
  };

  if (defectType) updateData.defectType = defectType;
  if (workshopStartStr) updateData.workshopStart = new Date(workshopStartStr);
  if (workshopEndStr) updateData.workshopEnd = new Date(workshopEndStr);
  if (adminNotes !== undefined && adminNotes !== null) updateData.adminNotes = adminNotes;

  const defect = await prisma.vehicleDefect.update({
    where: { id: defectId },
    data: updateData,
  });

  // Aktualizacja statusu pojazdu
  if (newStatus === "NAPRAWIONE" || newStatus === "ODRZUCONE") {
    const activeDefects = await prisma.vehicleDefect.count({
      where: {
        vehicleId: defect.vehicleId,
        status: { in: ["NOWE", "WARSZTAT"] }
      }
    });

    if (activeDefects === 0) {
      await prisma.vehicle.update({
        where: { id: defect.vehicleId },
        data: { status: "SPRAWNY" }
      });
    }
  } else if (newStatus === "WARSZTAT") {
    await prisma.vehicle.update({
      where: { id: defect.vehicleId },
      data: { status: "WARSZTAT" }
    });
  }

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/zarzad");
}
