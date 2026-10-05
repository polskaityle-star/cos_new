import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const vehicleId = formData.get("vehicleId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!vehicleId || !title || !description) {
    return NextResponse.json({ message: "Wypełnij wszystkie pola zgłoszenia" }, { status: 400 });
  }

  // Utwórz zgłoszenie
  await prisma.vehicleDefect.create({
    data: {
      userId: session.user.id,
      vehicleId,
      title,
      description,
      status: "NOWE"
    }
  });

  // Oznacz pojazd jako wymagający warsztatu
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status: "WARSZTAT" }
  });

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/kierowca");
}
