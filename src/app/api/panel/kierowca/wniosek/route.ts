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
  let details = formData.get("details") as string;
  const vehicleId = formData.get("vehicleId") as string;

  if (!type) {
    return NextResponse.json({ message: "Brak typu wniosku" }, { status: 400 });
  }

  // Weryfikacja urlopu (maksymalnie 14 dni)
  if (type === "URLOP") {
    if (!dateStartStr || !dateEndStr) {
      return NextResponse.json({ message: "Daty urlopu są wymagane" }, { status: 400 });
    }
    const start = new Date(dateStartStr);
    const end = new Date(dateEndStr);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 14) {
      return NextResponse.json(
        { message: "Urlop przez wniosek może wynosić maksymalnie 14 dni. W przypadku dłuższego urlopu skontaktuj się z Zarządem przez wiadomość." },
        { status: 400 }
      );
    }
  }

  // Weryfikacja powodu dla wniosku o zmianę etatu
  if (type === "ZMIANA_ETATU" && (!reason || reason.trim().length === 0)) {
    return NextResponse.json({ message: "Powód zmiany etatu jest wymagany." }, { status: 400 });
  }

  // Weryfikacja wniosku o odwieszenie konta
  if (type === "ODWIESZENIE" && (!reason || reason.trim().length === 0)) {
    return NextResponse.json({ message: "Uzasadnienie wniosku o odwieszenie konta jest wymagane." }, { status: 400 });
  }

  if (type === "DODATKOWA_SLUZBA" && vehicleId) {
    const veh = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (veh) {
      const vehText = `Preferowany pojazd: #${veh.fleetNumber} (${veh.model})`;
      details = details ? `${details} | ${vehText}` : vehText;
    }
  }

  // Budowa domyślnego opisu/uzasadnienia jeśli brak
  let finalReason = reason;
  if (!finalReason) {
    if (type === "DODATKOWA_SLUZBA") finalReason = "Wniosek o dodatkową służbę w wybranym dniu";
    else if (type === "STALY_POJAZD") finalReason = "Wniosek o przydzielenie stałego pojazdu";
    else if (type === "ZMIANA_STALEGO_POJAZDU") finalReason = "Wniosek o zmianę stałego pojazdu";
    else if (type === "USUNIECIE_STALEGO_POJAZDU") finalReason = "Wniosek o usunięcie stałego pojazdu (rezygnacja)";
    else if (type === "ZMIANA_ETATU") finalReason = "Wniosek o zmianę etatu (dni pracy)";
    else if (type === "ODWIESZENIE") finalReason = "Wniosek o odwieszenie konta";
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
