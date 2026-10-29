import { assertSameOrigin } from "@/lib/csrf";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRequests, isUserAdminOrOwner } from "@/lib/roles";
import { reviewRequest } from "@/lib/requests";

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canManageRequests(session.user.role, session.user.username)) {
    return NextResponse.json({ message: "Brak autoryzacji do zarządzania wnioskami" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const action = searchParams.get("action");

  // Czyszczenie historii wniosków (tylko dla admina/właściciela)
  if (action === "clear_history") {
    if (!isUserAdminOrOwner(session.user.role, session.user.username)) {
      return NextResponse.json({ message: "Brak uprawnień" }, { status: 403 });
    }
    await prisma.driverRequest.deleteMany({
      where: { status: { in: ["ACCEPTED", "REJECTED"] } },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    redirect("/panel/zarzad");
    return;
  }

  // Usuwanie pojedynczego wniosku (np. usunięcie urlopu przez Zarząd)
  if (action === "delete" && requestId) {
    const existing = await prisma.driverRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      return NextResponse.json({ message: "Wniosek nie istnieje" }, { status: 404 });
    }
    await prisma.driverRequest.delete({
      where: { id: requestId },
    });
    revalidatePath("/panel/zarzad");
    revalidatePath("/panel/kierowca");
    redirect("/panel/zarzad");
    return;
  }

  if (!requestId || !action) {
    return NextResponse.json({ message: "Brak parametrów" }, { status: 400 });
  }

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ message: "Nieprawidłowa akcja" }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  const rawRejectReason = formData?.get("rejectReason");
  const rejectReason =
    (typeof rawRejectReason === "string" ? rawRejectReason : null) || searchParams.get("reason") || "";

  const result = await reviewRequest({
    requestId,
    action,
    rejectReason,
    reviewerId: session.user.id,
    reviewerRole: session.user.role,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  revalidatePath("/panel/zarzad");
  revalidatePath("/panel/kierowca");
  redirect("/panel/zarzad");
}
