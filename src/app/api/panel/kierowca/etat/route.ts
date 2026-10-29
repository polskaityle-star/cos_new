import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_DAYS = ["PN", "WT", "SR", "CZ", "PT", "SO", "ND"];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workingDays: true },
    });

    if (user?.workingDays && user.workingDays.trim().length > 0) {
      return NextResponse.json(
        { message: "Etat został już wcześniej ustalony. Aby zmienić dni pracy, złóż wniosek o zmianę etatu w panelu kierowcy." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const days = body?.days;

    if (!Array.isArray(days) || days.length === 0) {
      return NextResponse.json({ message: "Wybierz przynajmniej jeden dzień w tygodniu." }, { status: 400 });
    }

    if (days.length > 6) {
      return NextResponse.json(
        { message: "Brak możliwości przekroczenia etatu 6/7! Możesz wybrać maksymalnie 6 dni w tygodniu." },
        { status: 400 }
      );
    }

    const uniqueDays = new Set(days);
    if (uniqueDays.size !== days.length) {
      return NextResponse.json({ message: "Dni etatu nie mogą się powtarzać." }, { status: 400 });
    }

    for (const day of days) {
      if (typeof day !== "string" || !ALLOWED_DAYS.includes(day)) {
        return NextResponse.json({ message: `Nieprawidłowy dzień: ${day}` }, { status: 400 });
      }
    }

    const workingDaysStr = days.join(",");

    await prisma.user.update({
      where: { id: session.user.id },
      data: { workingDays: workingDaysStr },
    });

    return NextResponse.json({ success: true, workingDays: workingDaysStr });
  } catch (error) {
    console.error("ETAT UPDATE ERROR", error);
    return NextResponse.json({ message: "Błąd podczas zapisu etatu." }, { status: 500 });
  }
}
