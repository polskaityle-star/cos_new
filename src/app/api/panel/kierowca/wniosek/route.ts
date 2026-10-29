import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COLORS, runAfter, sendToChannel } from "@/lib/discord";

const ALLOWED_TYPES = [
  "DODATKOWA_SLUZBA",
  "STALY_POJAZD",
  "ZMIANA_STALEGO_POJAZDU",
  "USUNIECIE_STALEGO_POJAZDU",
  "ZMIANA_ETATU",
  "ODWIESZENIE",
  "ANULOWANIE_SLUZBY",
  "URLOP",
] as const;

type AllowedType = (typeof ALLOWED_TYPES)[number];

const VALID_DAYS = ["PN", "WT", "SR", "CZ", "PT", "SO", "ND"];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
  }

  const formData = await req.formData();
  const rawType = formData.get("type");
  const type = typeof rawType === "string" ? rawType.trim() : "";
  const rawReason = formData.get("reason");
  const reason = typeof rawReason === "string" ? rawReason.trim() : "";
  const rawDateStart = formData.get("dateStart");
  const dateStartStr = typeof rawDateStart === "string" ? rawDateStart.trim() : "";
  const rawDateEnd = formData.get("dateEnd");
  const dateEndStr = typeof rawDateEnd === "string" ? rawDateEnd.trim() : "";
  const rawDutyId = formData.get("dutyId");
  const dutyId = typeof rawDutyId === "string" ? rawDutyId.trim() : "";
  const rawDetails = formData.get("details");
  let details = typeof rawDetails === "string" ? rawDetails.trim() : "";
  const rawVehicleId = formData.get("vehicleId");
  const vehicleId = typeof rawVehicleId === "string" ? rawVehicleId.trim() : "";

  if (!type || !ALLOWED_TYPES.includes(type as AllowedType)) {
    return NextResponse.json({ message: "Nieprawidłowy typ wniosku" }, { status: 400 });
  }

  // Użytkownik zawieszony może złożyć tylko wniosek ODWIESZENIE
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { suspended: true },
  });
  if (user?.suspended && type !== "ODWIESZENIE") {
    return NextResponse.json(
      { message: "Twoje konto jest zawieszone. Możesz złożyć jedynie wniosek o odwieszenie konta." },
      { status: 403 }
    );
  }

  // Weryfikacja powiązania ze służbą
  if (type === "ANULOWANIE_SLUZBY" && !dutyId) {
    return NextResponse.json({ message: "Brak ID służby do anulowania" }, { status: 400 });
  }

  if (dutyId) {
    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
    });
    if (!duty || duty.userId !== session.user.id) {
      return NextResponse.json({ message: "Wskazana służba nie istnieje lub nie należy do Ciebie" }, { status: 403 });
    }
  }

  // Weryfikacja urlopu
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (type === "URLOP") {
    if (!dateStartStr || !dateEndStr) {
      return NextResponse.json({ message: "Daty rozpoczęcia i zakończenia urlopu są wymagane" }, { status: 400 });
    }
    startDate = new Date(dateStartStr);
    endDate = new Date(dateEndStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ message: "Nieprawidłowy format daty urlopu" }, { status: 400 });
    }
    if (endDate.getTime() < startDate.getTime()) {
      return NextResponse.json(
        { message: "Data zakończenia urlopu nie może być wcześniejsza niż data rozpoczęcia" },
        { status: 400 }
      );
    }
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 14) {
      return NextResponse.json(
        { message: "Urlop przez wniosek może wynosić maksymalnie 14 dni. W przypadku dłuższego urlopu skontaktuj się z Zarządem przez wiadomość." },
        { status: 400 }
      );
    }
  } else {
    if (dateStartStr) {
      const parsedStart = new Date(dateStartStr);
      if (!isNaN(parsedStart.getTime())) startDate = parsedStart;
    }
    if (dateEndStr) {
      const parsedEnd = new Date(dateEndStr);
      if (!isNaN(parsedEnd.getTime())) endDate = parsedEnd;
    }
  }

  // Weryfikacja dla STALY_POJAZD / ZMIANA_STALEGO_POJAZDU
  if (type === "STALY_POJAZD" || type === "ZMIANA_STALEGO_POJAZDU") {
    if (!details) {
      return NextResponse.json({ message: "Wymagane jest wskazanie pojazdu" }, { status: 400 });
    }
    const veh = await prisma.vehicle.findUnique({ where: { id: details } });
    if (!veh) {
      return NextResponse.json({ message: "Wskazany pojazd nie istnieje" }, { status: 400 });
    }
  }

  // Weryfikacja dla ZMIANA_ETATU
  if (type === "ZMIANA_ETATU") {
    if (!details) {
      return NextResponse.json({ message: "Wymagane jest wskazanie dni etatu" }, { status: 400 });
    }
    const days = details.split(",").map((d) => d.trim()).filter(Boolean);
    if (days.length === 0 || days.length > 6) {
      return NextResponse.json({ message: "Etat może obejmować od 1 do maksymalnie 6 dni w tygodniu" }, { status: 400 });
    }
    const uniqueDays = new Set(days);
    if (uniqueDays.size !== days.length) {
      return NextResponse.json({ message: "Dni etatu nie mogą się powtarzać" }, { status: 400 });
    }
    for (const d of days) {
      if (!VALID_DAYS.includes(d)) {
        return NextResponse.json({ message: `Nieprawidłowy dzień etatu: ${d}` }, { status: 400 });
      }
    }
    if (!reason) {
      return NextResponse.json({ message: "Powód zmiany etatu jest wymagany." }, { status: 400 });
    }
  }

  // Weryfikacja wniosku o odwieszenie konta
  if (type === "ODWIESZENIE" && !reason) {
    return NextResponse.json({ message: "Uzasadnienie wniosku o odwieszenie konta jest wymagane." }, { status: 400 });
  }

  // Preferowany pojazd przy dodatkowej służbie
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

  // Limity znaków
  if (finalReason.length > 1000) {
    return NextResponse.json({ message: "Uzasadnienie wniosku może mieć maksymalnie 1000 znaków" }, { status: 400 });
  }
  if (details.length > 500) {
    return NextResponse.json({ message: "Szczegóły wniosku mogą mieć maksymalnie 500 znaków" }, { status: 400 });
  }

  // Sprawdzanie duplikatów PENDING
  if (type === "URLOP" && startDate && endDate) {
    const overlapping = await prisma.driverRequest.findFirst({
      where: {
        userId: session.user.id,
        type: "URLOP",
        status: "PENDING",
        dateStart: { lte: endDate },
        dateEnd: { gte: startDate },
      },
    });
    if (overlapping) {
      return NextResponse.json(
        { message: "Masz już oczekujący wniosek urlopowy obejmujący ten zakres dat" },
        { status: 409 }
      );
    }
  } else if (dutyId) {
    const duplicateDuty = await prisma.driverRequest.findFirst({
      where: {
        userId: session.user.id,
        type,
        status: "PENDING",
        dutyId,
      },
    });
    if (duplicateDuty) {
      return NextResponse.json(
        { message: "Złożyłeś już oczekujący wniosek dla tej służby" },
        { status: 409 }
      );
    }
  } else {
    const duplicate = await prisma.driverRequest.findFirst({
      where: {
        userId: session.user.id,
        type,
        status: "PENDING",
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { message: "Masz już oczekujący wniosek tego typu" },
        { status: 409 }
      );
    }
  }

  await prisma.driverRequest.create({
    data: {
      userId: session.user.id,
      type,
      reason: finalReason,
      dateStart: startDate,
      dateEnd: endDate,
      dutyId: dutyId || null,
      details: details || null,
      status: "PENDING",
    },
  });

  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  const driverLabel = `${session.user.username}${session.user.badgeNumber ? ` [${session.user.badgeNumber}]` : ""}`;
  await runAfter(() =>
    sendToChannel("WNIOSKI", [
      {
        title: `Nowy wniosek: ${type}`,
        color: COLORS.warn,
        description: finalReason,
        fields: [
          { name: "Kierowca", value: driverLabel, inline: true },
          ...(dateStartStr ? [{ name: "Od", value: dateStartStr, inline: true }] : []),
          ...(dateEndStr ? [{ name: "Do", value: dateEndStr, inline: true }] : []),
        ],
      },
    ])
  );

  redirect("/panel/kierowca");
}
