import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageFleet } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageFleet(session.user.role, (session.user as any)?.username)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const newStatus = searchParams.get("status") || "SPRAWNY";

  if (id) {
    await prisma.vehicle.update({
      where: { id },
      data: { status: newStatus },
    });

    if (newStatus === "SPRAWNY") {
      await prisma.vehicleDefect.updateMany({
        where: { vehicleId: id, status: { in: ["NOWE", "WARSZTAT"] } },
        data: {
          status: "NAPRAWIONE",
          adminNotes: "Naprawione - pojazd oznaczony jako sprawny z zarządzania taborem",
        },
      });
    }

    revalidatePath("/tabor");
    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");
  }

  redirect("/panel/zarzad");
}
