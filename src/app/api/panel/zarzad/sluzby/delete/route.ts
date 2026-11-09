import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageDuties } from "@/lib/roles";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageDuties(session.user.role)) {
    return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "Nie podano ID" }, { status: 404 });
  }

  const duty = await prisma.duty.findUnique({
    where: { id },
    include: { report: true },
  });

  if (!duty) {
    return NextResponse.json({ message: "Służba nie istnieje" }, { status: 404 });
  }

  if (duty.report != null || duty.status === "COMPLETED") {
    return NextResponse.json(
      { message: "Nie można usunąć służby z raportem. Najpierw rozpatrz raport w panelu." },
      { status: 409 }
    );
  }

  await prisma.duty.delete({
    where: { id }
  });
  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");

  redirect("/panel/zarzad");
}
