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
  const reportId = searchParams.get("reportId");
  const action = searchParams.get("action");
  
  if (!reportId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action === "accept") {
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: { status: "ACCEPTED" },
      include: { duty: true }
    });

    if (updatedReport.duty?.vehicleId && updatedReport.endMileage > 0) {
      await prisma.vehicle.update({
        where: { id: updatedReport.duty.vehicleId },
        data: { mileage: updatedReport.endMileage }
      });
      revalidatePath("/tabor");
    }
  } else if (action === "reject") {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "REJECTED" }
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");
  revalidatePath("/tabor");
  redirect("/panel/zarzad");
}
