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
  const type = formData.get("type") as string;
  const reason = formData.get("reason") as string;
  const dateStartStr = formData.get("dateStart") as string;
  const dateEndStr = formData.get("dateEnd") as string;
  const dutyId = formData.get("dutyId") as string;
  const details = formData.get("details") as string;

  if (!type) {
    return NextResponse.json({ message: "Brak typu wniosku" }, { status: 400 });
  }

  // Budowa domyślnego opisu/uzasadnienia jeśli brak
  let finalReason = reason;
  if (!finalReason) {
    if (type === "DODATKOWA_SLUZBA") finalReason = "Wniosek o dodatkową służbę w wybranym dniu";
    else if (type === "STALY_POJAZD") finalReason = "Wniosek o przydzielenie/zmianę stałego pojazdu";
    else if (type === "ZMIANA_ETATU") finalReason = "Wniosek o zmianę etatu (dni pracy)";
    else if (type === "ANULOWANIE_SLUZBY") finalReason = "Prośba o anulowanie służby";
    else if (type === "URLOP") finalReason = "Wniosek o urlop wypoczynkowy";
    else finalReason = "Brak uzasadnienia";
  }

  await prisma.driverRequest.create({
    data: {
      userId: session.user.id,
      type,
      reason: finalReason,
      dateStart: dateStartStr ? new Date(dateStartStr) : null,
      dateEnd: dateEndStr ? new Date(dateEndStr) : null,
      dutyId: dutyId || null,
      details: details || null,
      status: "PENDING",
    }
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/kierowca");
}
