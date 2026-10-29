import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isUserAdminOrOwner } from "@/lib/roles";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const formData = await req.formData();
    const requestId = formData.get("requestId") as string;
    const dateStartStr = formData.get("dateStart") as string;
    const dateEndStr = formData.get("dateEnd") as string;
    const reason = formData.get("reason") as string;

    if (!requestId || !dateStartStr || !dateEndStr) {
      return NextResponse.json({ message: "Brak wymaganych danych urlopu." }, { status: 400 });
    }

    const request = await prisma.driverRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.type !== "URLOP") {
      return NextResponse.json({ message: "Wniosek urlopowy nie został odnaleziony." }, { status: 404 });
    }

    // Kierowca może edytować swój urlop, a Zarząd/Właściciel każdy urlop
    const isPrivileged = isUserAdminOrOwner(session.user.role);
    if (request.userId !== session.user.id && !isPrivileged) {
      return NextResponse.json({ message: "Brak uprawnień do edycji tego urlopu." }, { status: 403 });
    }

    // Zwykły kierowca może edytować wniosek TYLKO w statusie PENDING
    if (!isPrivileged && request.status !== "PENDING") {
      return NextResponse.json(
        { message: "Możesz edytować wniosek urlopowy tylko w statusie oczekującym (PENDING)." },
        { status: 400 }
      );
    }

    const dStart = new Date(dateStartStr);
    const dEnd = new Date(dateEndStr);

    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
      return NextResponse.json({ message: "Nieprawidłowy format daty." }, { status: 400 });
    }

    if (dEnd < dStart) {
      return NextResponse.json(
        { message: "Data zakończenia urlopu nie może być wcześniejsza niż data rozpoczęcia." },
        { status: 400 }
      );
    }

    // Obie daty nie w przeszłości
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dStart < today) {
      return NextResponse.json(
        { message: "Data rozpoczęcia urlopu nie może być w przeszłości." },
        { status: 400 }
      );
    }

    const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 14 && (!reason || reason.trim().length < 5)) {
      return NextResponse.json(
        {
          message: `Urlop przekracza standardowe 14 dni (${diffDays} dni). Wymagane jest szczegółowe uzasadnienie.`,
        },
        { status: 400 }
      );
    }

    await prisma.driverRequest.update({
      where: { id: requestId },
      data: {
        dateStart: dStart,
        dateEnd: dEnd,
        reason: reason || request.reason,
      },
    });

    revalidatePath("/panel/kierowca");
    revalidatePath("/panel/zarzad");

    const referer = req.headers.get("referer");
    if (referer) {
      return NextResponse.redirect(referer, 303);
    }
    return NextResponse.redirect(new URL("/panel/kierowca", req.url), 303);
  } catch (error) {
    console.error("EDIT VACATION ERROR", error);
    return NextResponse.json({ message: "Błąd serwera podczas edycji urlopu." }, { status: 500 });
  }
}
