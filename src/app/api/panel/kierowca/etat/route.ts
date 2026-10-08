import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: "Brak autoryzacji" }, { status: 401 });
    }

    const { days } = await req.json();
    if (!Array.isArray(days) || days.length === 0) {
      return NextResponse.json({ message: "Wybierz przynajmniej jeden dzień w tygodniu." }, { status: 400 });
    }

    if (days.length > 6) {
      return NextResponse.json({
        message: "Brak możliwości przekroczenia etatu 6/7! Możesz wybrać maksymalnie 6 dni w tygodniu."
      }, { status: 400 });
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
