import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageFleet } from "@/lib/roles";

const ALLOWED_STATUSES = ["SPRAWNY", "WARSZTAT", "KASACJA"];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageFleet(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania flotą" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const newStatus = searchParams.get("status");

  if (!id) {
    return NextResponse.json({ message: "Brak ID pojazdu" }, { status: 400 });
  }

  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return NextResponse.json({ message: "Nieprawidłowy status pojazdu" }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) {
    return NextResponse.json({ message: "Pojazd nie istnieje" }, { status: 404 });
  }

  await prisma.vehicle.update({
    where: { id },
    data: { status: newStatus },
  });

  if (newStatus === "SPRAWNY") {
    // Zamykamy tylko defekty o statusie WARSZTAT (NOWE zostają do ręcznej decyzji)
    await prisma.vehicleDefect.updateMany({
      where: { vehicleId: id, status: "WARSZTAT" },
      data: {
        status: "NAPRAWIONE",
        adminNotes: "Naprawione - pojazd oznaczony jako sprawny z zarządzania taborem",
      },
    });
  }

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/zarzad");
}
