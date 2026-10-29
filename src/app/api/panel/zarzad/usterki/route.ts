import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageFleet } from "@/lib/roles";
import { reviewDefect, ReviewDefectOptions } from "@/lib/defects";

const ALLOWED_DEFECT_STATUSES = ["NOWE", "WARSZTAT", "NAPRAWIONE", "ODRZUCONE"];

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageFleet(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak uprawnień do zarządzania taborem" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const defectId = searchParams.get("defectId");
  const actionParam = searchParams.get("newStatus") || searchParams.get("action");

  // Czyszczenie historii napraw
  if (actionParam === "clear_history") {
    await prisma.vehicleDefect.deleteMany({
      where: { status: { in: ["NAPRAWIONE", "ODRZUCONE"] } },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    return redirect("/panel/zarzad");
  }

  const formData = await req.formData().catch(() => null);
  const rawFormStatus = formData?.get("status");
  const formStatus = typeof rawFormStatus === "string" ? rawFormStatus.trim() : "";
  const newStatus = actionParam || formStatus;

  if (!defectId || !newStatus) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (!ALLOWED_DEFECT_STATUSES.includes(newStatus)) {
    return NextResponse.json({ message: "Nieprawidłowy status usterki" }, { status: 400 });
  }

  const existingDefect = await prisma.vehicleDefect.findUnique({
    where: { id: defectId },
  });

  if (!existingDefect) {
    return NextResponse.json({ message: "Usterka nie istnieje" }, { status: 404 });
  }

  const rawDefectType = formData?.get("defectType");
  const defectType = typeof rawDefectType === "string" ? rawDefectType.trim() : undefined;
  const rawWorkshopStartStr = formData?.get("workshopStart");
  const workshopStartStr = typeof rawWorkshopStartStr === "string" ? rawWorkshopStartStr.trim() : "";
  const rawWorkshopEndStr = formData?.get("workshopEnd");
  const workshopEndStr = typeof rawWorkshopEndStr === "string" ? rawWorkshopEndStr.trim() : "";
  const rawAdminNotes = formData?.get("adminNotes");
  const adminNotes = typeof rawAdminNotes === "string" ? rawAdminNotes.trim() : undefined;

  let workshopStart: Date | undefined;
  let workshopEnd: Date | undefined;

  if (workshopStartStr) {
    const d = new Date(workshopStartStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ message: "Nieprawidłowa data rozpoczęcia naprawy" }, { status: 400 });
    }
    workshopStart = d;
  }

  if (workshopEndStr) {
    const d = new Date(workshopEndStr);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ message: "Nieprawidłowa data zakończenia naprawy" }, { status: 400 });
    }
    workshopEnd = d;
  }

  if (workshopStart && workshopEnd && workshopEnd.getTime() < workshopStart.getTime()) {
    return NextResponse.json(
      { message: "Data zakończenia naprawy nie może być wcześniejsza niż data rozpoczęcia" },
      { status: 400 }
    );
  }

  if (adminNotes && adminNotes.length > 2000) {
    return NextResponse.json({ message: "Notatki administratora mogą mieć maksymalnie 2000 znaków" }, { status: 400 });
  }

  const result = await reviewDefect({
    defectId,
    status: newStatus as ReviewDefectOptions["status"],
    defectType,
    workshopStart,
    workshopEnd,
    adminNotes,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  revalidatePath("/tabor");
  revalidatePath("/panel/kierowca");
  revalidatePath("/panel/zarzad");

  redirect("/panel/zarzad");
}
