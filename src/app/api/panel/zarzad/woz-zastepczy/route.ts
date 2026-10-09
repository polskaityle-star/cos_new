import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canAssignReplacementVehicle, getRoleLabel } from "@/lib/roles";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canAssignReplacementVehicle(session.user.role)) {
    return NextResponse.json(
      { message: "Brak uprawnień do wyznaczania wozu zastępczego (wymagana rola Mechanik, Sprawdzający, Dyspozytor lub Właściciel)" },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const dutyId = formData.get("dutyId") as string;
  const replacementVehicleId = formData.get("replacementVehicleId") as string;
  const reason = formData.get("reason") as string;

  if (!dutyId) {
    return NextResponse.json({ message: "Brak ID służby" }, { status: 400 });
  }

  const duty = await prisma.duty.findUnique({
    where: { id: dutyId },
    include: { user: true, vehicle: true, line: true },
  });

  if (!duty) {
    return NextResponse.json({ message: "Służba nie istnieje" }, { status: 404 });
  }

  let repVehicle = null;
  if (replacementVehicleId) {
    repVehicle = await prisma.vehicle.findUnique({
      where: { id: replacementVehicleId },
    });
  }

  await prisma.duty.update({
    where: { id: dutyId },
    data: {
      replacementVehicleId: replacementVehicleId || null,
    },
  });

  // Jeśli przydzielono wóz zastępczy, wyślij kierowcy powiadomienie
  if (repVehicle && duty.user) {
    const senderRole = getRoleLabel(session.user.role);
    await prisma.driverNotification.create({
      data: {
        userId: duty.user.id,
        sender: `${session.user.username} (${senderRole})`,
        title: `🔄 Przydzielono wóz zastępczy: #${repVehicle.fleetNumber}`,
        message: `W związku z awarią na linii ${duty.line.number} (brygada: ${duty.brigade || "b/d"}), wyznaczono dla Ciebie pojazd zastępczy: #${repVehicle.fleetNumber} - ${repVehicle.model} (${repVehicle.registration}). ${reason ? `Powód/informacja: ${reason}` : ""}`,
      },
    });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
