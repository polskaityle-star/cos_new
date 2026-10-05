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

    const body = await req.json();
    const { dutyId, startMileage, endMileage, startScreenshot, endScreenshot, summaryFile } = body;

    if (!dutyId || startMileage === undefined || endMileage === undefined || !startScreenshot || !endScreenshot || !summaryFile) {
      return NextResponse.json({ message: "Brakujące dane" }, { status: 400 });
    }

    // Weryfikacja czy służba należy do tego kierowcy i nie ma jeszcze raportu
    const duty = await prisma.duty.findUnique({
      where: { id: dutyId },
      include: { report: true }
    });

    if (!duty) {
      return NextResponse.json({ message: "Służba nie znaleziona" }, { status: 404 });
    }

    if (duty.userId !== session.user.id) {
      return NextResponse.json({ message: "To nie jest twoja służba" }, { status: 403 });
    }

    if (duty.report) {
      return NextResponse.json({ message: "Raport dla tej służby już istnieje" }, { status: 400 });
    }

    // Tworzenie raportu i aktualizacja statusu sluzby
    await prisma.$transaction([
      prisma.report.create({
        data: {
          dutyId,
          startMileage,
          endMileage,
          startScreenshot,
          endScreenshot,
          summaryFile
        }
      }),
      prisma.duty.update({
        where: { id: dutyId },
        data: { status: "COMPLETED" }
      })
    ]);

    return NextResponse.json({ message: "Raport został wysłany." }, { status: 201 });
  } catch (error) {
    console.error("REPORT ERROR", error);
    return NextResponse.json({ message: "Błąd serwera" }, { status: 500 });
  }
}
