import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || session.user.role !== "ZARZAD") {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const carrier = formData.get("carrier") as string;
  const model = formData.get("model") as string;
  const registration = formData.get("registration") as string;
  const fleetNumber = formData.get("fleetNumber") as string;

  if (carrier && model && registration && fleetNumber) {
    await prisma.vehicle.create({
      data: { carrier, model, registration, fleetNumber }
    });
  }

  redirect("/panel/zarzad");
}
